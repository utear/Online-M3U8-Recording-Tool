require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  db,
  addTask,
  updateTaskStatus,
  updateTaskOutput,
  getAllTasks,
  addTaskHistory,
  getTaskHistory
} = require(path.join(__dirname, 'models', 'database'));
const iptvService = require(path.join(__dirname, 'services', 'iptvService'));
const iptvRoutes = require(path.join(__dirname, 'routes', 'iptvRoutes'));
const authRoutes = require(path.join(__dirname, 'routes', 'auth'));
const { validateUser, getUser, registerUser } = require(path.join(__dirname, 'models', 'userDb'));

const app = express();
const port = process.env.PORT || 3001;
const host = process.env.HOST || 'localhost';
const wsPort = process.env.WS_PORT || 3002;

// 获取系统环境变量
const processEnv = process.env;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 初始化IPTV服务
iptvService.init().catch(console.error);

// 路由配置
app.use('/api/iptv', iptvRoutes);
app.use('/api/auth', authRoutes);

// 静态文件服务配置
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 中间件：验证JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未授权' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('token验证失败:', err);
      return res.status(403).json({ message: '无效的token' });
    }

    req.user = decoded;
    next();
  });
};

// 登录路由
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    // 验证用户
    const user = await validateUser(username, password);

    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 生成token，使用数据库中的角色信息
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role  // 使用数据库中的角色
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role  // 使用数据库中的角色
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '登录失败' });
  }
});

// 注册路由
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    // 检查用户名是否已存在
    const existingUser = await getUser(username);
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 创建新用户
    await registerUser(username, password);

    res.status(201).json({ message: '注册成功' });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 刷新token路由
app.post('/api/auth/refresh-token', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    // 即使token过期也尝试解码
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(403).json({ message: '无效的token' });
    }

    // 获取用户信息
    const user = await getUser(decoded.username);
    if (!user) {
      return res.status(403).json({ message: '用户不存在' });
    }

    // 生成新token
    const newToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token: newToken });
  } catch (error) {
    console.error('刷新token失败:', error);
    res.status(403).json({ message: '刷新token失败' });
  }
});

// 获取用户信息
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUser(req.user.username);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// 存储所有活动的录制任务
const activeTasks = new Map();

// 确保下载目录存在
const ensureDownloadDir = (dir) => {
  const fullPath = path.resolve(dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

// 获取文件大小
const getFileSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
};

// 处理进程输入的函数
const handleProcessInput = (taskId, input) => {
  const task = activeTasks.get(taskId);
  if (task && task.process && task.process.stdin) {
    console.log(`向任务 ${taskId} 发送输入:`, input);
    task.process.stdin.write(input + '\n');
  }
};

// WebSocket服务器
const wss = new WebSocket.Server({ port: wsPort });

// 存储WebSocket连接和任务ID的映射
const wsConnections = new Map();

// 保持WebSocket连接活跃
const keepAlive = () => {
  wss.clients.forEach(client => {
    if (!client.isAlive) {
      console.log('WebSocket客户端心跳超时，关闭连接');
      wsConnections.delete(client);
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
};

// 每30秒检查一次心跳
const heartbeatInterval = setInterval(keepAlive, 30000);

// 当服务器关闭时清理心跳定时器
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws) => {
  console.log('WebSocket客户端已连接');

  // 初始化连接状态
  ws.isAlive = true;

  // 处理 pong 消息
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'ping') {
        ws.isAlive = true;
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'subscribe') {
        // 如果已经订阅了其他任务，先取消订阅
        if (wsConnections.has(ws)) {
          const oldTaskId = wsConnections.get(ws);
          if (oldTaskId !== data.taskId) {
            console.log(`WebSocket客户端取消订阅任务 ${oldTaskId}`);
          }
        }

        // 订阅新任务
        wsConnections.set(ws, data.taskId);
        console.log(`WebSocket客户端订阅任务 ${data.taskId}`);

        // 发送任务历史输出
        const task = activeTasks.get(data.taskId);
        if (task && task.outputHistory) {
          ws.send(JSON.stringify({
            type: 'terminal_history',
            taskId: data.taskId,
            output: task.outputHistory
          }));
        }
      }
      else if (data.type === 'unsubscribe') {
        wsConnections.delete(ws);
        console.log(`WebSocket客户端取消订阅任务 ${data.taskId}`);
      }
      else if (data.type === 'process_input') {
        handleProcessInput(data.taskId, data.input);
      }
    } catch (error) {
      console.error('处理WebSocket消息时出错:', error);
    }
  });

  // 处理连接关闭
  ws.on('close', () => {
    console.log('WebSocket客户端已断开');
    wsConnections.delete(ws);
  });

  // 处理错误
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
    wsConnections.delete(ws);
  });
});

// 添加消息缓冲区
const messageBuffer = new Map();
const MESSAGE_BATCH_INTERVAL = 200; // 200ms发送一次消息

// 批量发送消息的函数
const flushMessages = (taskId) => {
  const buffer = messageBuffer.get(taskId);
  if (buffer && buffer.length > 0) {
    const lastMessage = buffer[buffer.length - 1];
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(lastMessage));
      }
    });
    messageBuffer.set(taskId, []);
  }
};

// 设置定时发送
setInterval(() => {
  for (const taskId of messageBuffer.keys()) {
    flushMessages(taskId);
  }
}, MESSAGE_BATCH_INTERVAL);

// 广播任务输出到订阅的客户端
const broadcastTaskOutput = (taskId, output, type = 'terminal_output') => {
  wss.clients.forEach(client => {
    if (wsConnections.get(client) === taskId) {
      client.send(JSON.stringify({
        type,
        taskId,
        output
      }));
    }
  });
};

// 开始录制的API
app.post('/api/start-recording', authenticateToken, async (req, res) => {
  try {
    const { url, options } = req.body;
    const taskId = Date.now().toString();
    const username = req.user.username;

    // 构建命令行参数
    const args = [url];

    // 处理保存目录路径
    let saveDir = options['save-dir'] || './downloads';
    let tmpDir = options['tmp-dir'] || './temp';

    // 如果是相对路径，转换为绝对路径
    if (!path.isAbsolute(saveDir)) {
      saveDir = path.resolve(__dirname, saveDir);
    }
    if (!path.isAbsolute(tmpDir)) {
      tmpDir = path.resolve(__dirname, tmpDir);
    }

    console.log('最终保存目录:', saveDir);
    console.log('最终临时目录:', tmpDir);

    // 确保目录存在并更新选项
    ensureDownloadDir(saveDir);
    ensureDownloadDir(tmpDir);
    options['save-dir'] = saveDir;
    options['tmp-dir'] = tmpDir;

    // 添加所有选项
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          if (typeof value === 'boolean') {
            args.push(`--${key}`);
            args.push(value.toString());
          } else {
            args.push(`--${key}`);
            args.push(value.toString());
          }
        }
      });
    }

    const cmdStr = `${path.join(__dirname, '..', 'Sever.exe')} ${args.join(' ')}`;
    console.log('启动命令:', cmdStr);

    // 启动录制进程，允许输入输出
    const childProcess = spawn(path.join(__dirname, '..', 'Sever.exe'), args, {
      env: {
        ...processEnv,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'zh_CN.UTF-8'
      },
      stdio: ['pipe', 'pipe', 'pipe'] // 启用标准输入输出
    });

    // 创建任务记录
    const task = {
      id: taskId,
      username: req.user.username,
      url,
      status: 'running',
      createdAt: new Date().toISOString(),
      lastOutput: '',
      outputFile: '',
      options: JSON.stringify(options)
    };

    await addTask(task);
    console.log(`[${new Date().toLocaleString()}] 创建新任务:`, { taskId, url, username });

    // 存储任务信息
    const outputFile = path.join(options['save-dir'], options['save-name'] || 'output.ts');
    activeTasks.set(taskId, {
      id: taskId,
      username: req.user.username,
      url,
      status: 'running',
      createdAt: new Date().toISOString(),
      options,
      process: childProcess,
      outputFile,
      saveDir: options['save-dir'],
      outputHistory: '' // 存储历史输出
    });

    // 处理进程输出
    childProcess.stdout.on('data', async (data) => {
      const output = iconv.decode(data, 'gb2312')
        .replace(/\r\n/g, '\n')  // 统一换行符
        .replace(/\r/g, '\n')
        .trim();

      if (!output) return;  // 忽略空输出

      console.log(`任务 ${taskId} 输出:`, output);

      // 更新任务的历史输出
      const task = activeTasks.get(taskId);
      if (task) {
        task.outputHistory += output + '\n';  // 确保每条输出后面都有换行

        // 检查输出中是否包含文件大小信息
        const fileSizeMatch = output.match(/(\d+(\.\d+)?)\s*MB/);
        if (fileSizeMatch) {
          const fileSizeMB = parseFloat(fileSizeMatch[1]);
          task.fileSize = fileSizeMB * 1024 * 1024; // 转换为字节
        }

        // 检查输出中是否包含保存文件名信息
        const saveNameMatch = output.match(/保存文件名:\s*(.+)/);
        if (saveNameMatch && task) {
          const actualFileName = saveNameMatch[1].trim();
          task.outputFile = path.join(task.saveDir, `${actualFileName}.ts`);
          console.log(`任务 ${taskId} 更新实际输出文件路径:`, task.outputFile);
        }
      }

      // 将消息添加到缓冲区
      if (!messageBuffer.has(taskId)) {
        messageBuffer.set(taskId, []);
      }
      messageBuffer.get(taskId).push({
        type: 'progress',
        taskId,
        output: output + '\n',  // 确保每条输出后面都有换行
        fileSize: task ? task.fileSize : 0
      });

      // 更新数据库
      await updateTaskStatus(taskId, 'running', output);
      await addTaskHistory(taskId, output);
    });

    // 处理进程错误
    childProcess.stderr.on('data', async (data) => {
      const error = iconv.decode(data, 'gb2312');
      console.error(`任务 ${taskId} 错误:`, error.trim());

      // 将消息添加到缓冲区
      if (!messageBuffer.has(taskId)) {
        messageBuffer.set(taskId, []);
      }
      messageBuffer.get(taskId).push({
        type: 'progress',
        taskId,
        output: `错误: ${error.trim()}`
      });

      // 更新数据库
      await updateTaskStatus(taskId, 'running', `错误: ${error.trim()}`);
      await addTaskHistory(taskId, `错误: ${error.trim()}`);
    });

    // 处理进程结束
    childProcess.on('close', async (code) => {
      console.log(`任务 ${taskId} 结束，退出码:`, code);
      const task = activeTasks.get(taskId);
      if (task) {
        console.log(`任务 ${taskId} 输出文件路径:`, task.outputFile);
        console.log(`任务 ${taskId} 保存目录:`, task.saveDir);

        // 检查文件是否存在
        const checkFileExists = (filePath) => {
          // 获取文件名（不含扩展名）和目录
          const dir = path.dirname(filePath);
          const baseNameWithoutExt = path.basename(filePath, path.extname(filePath));

          // 读取目录下所有文件
          const files = fs.readdirSync(dir);

          // 检查是否存在相同文件名（不考虑扩展名）的文件
          return files.some(file => {
            const currentBaseNameWithoutExt = path.basename(file, path.extname(file));
            return currentBaseNameWithoutExt === baseNameWithoutExt;
          });
        };

        const fileExists = checkFileExists(task.outputFile);
        console.log(`任务 ${taskId} 文件是否存在:`, fileExists);

        // 列出保存目录中的文件
        console.log(`任务 ${taskId} 保存目录内容:`, fs.readdirSync(task.saveDir));

        let status = 'failed';
        if (fileExists) {
          status = task.status === 'stopped' ? 'paused' : 'completed';
        }
        task.status = status;

        // 更新数据库
        await updateTaskStatus(taskId, status);
        if (fileExists) {
          // 获取实际文件路径和大小
          const dir = path.dirname(task.outputFile);
          const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));
          const files = fs.readdirSync(dir);
          const actualFile = files.find(file => path.basename(file, path.extname(file)) === baseNameWithoutExt);
          if (actualFile) {
            const actualFilePath = path.join(dir, actualFile);
            const fileSize = fs.statSync(actualFilePath).size;
            task.fileSize = fileSize;
            await updateTaskOutput(taskId, actualFilePath, fileSize);
          }
        }

        // 将消息添加到缓冲区
        if (!messageBuffer.has(taskId)) {
          messageBuffer.set(taskId, []);
        }
        messageBuffer.get(taskId).push({
          type: 'status',
          taskId,
          status,
          fileSize: task.fileSize,
          outputFile: task.outputFile
        });
      }
    });

    res.json({ taskId });
  } catch (error) {
    console.error('启动录制失败:', error);
    res.status(500).json({ message: '启动录制失败' });
  }
});

// 获取任务列表
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const tasks = await getAllTasks(req.user.username, isAdmin);
    res.json(tasks);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ message: '获取任务列表失败' });
  }
});

// 获取任务历史记录的API
app.get('/api/tasks/:taskId/history', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const history = await getTaskHistory(taskId);
    res.json(history);
  } catch (error) {
    console.error('获取任务历史失败:', error);
    res.status(500).json({ message: '获取任务历史失败' });
  }
});

// 停止录制的API
app.post('/api/stop-recording/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = activeTasks.get(taskId);

    if (!task || !task.process) {
      res.status(404).json({ message: '任务不存在或已经停止' });
      return;
    }

    // Windows下使用taskkill强制结束进程树
    spawn('taskkill', ['/pid', task.process.pid, '/f', '/t']);

    await updateTaskStatus(taskId, 'stopped');
    task.status = 'stopped';
    task.process = null;

    res.json({ message: '录制已停止' });
  } catch (error) {
    console.error('停止录制失败:', error);
    res.status(500).json({ message: '停止录制失败' });
  }
});

// 删除任务的API
app.delete('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    console.log(`[${new Date().toLocaleString()}] 开始删除任务: ${taskId}`);

    // 获取任务信息，以便获取文件名
    const taskInfo = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!taskInfo) {
      console.log(`[${new Date().toLocaleString()}] 任务不存在: ${taskId}`);
      return res.status(404).json({ message: '任务不存在' });
    }
    console.log(`[${new Date().toLocaleString()}] 获取到任务信息:`, {
      taskId: taskInfo.id,
      outputFile: taskInfo.outputFile,
      status: taskInfo.status
    });

    // 停止正在运行的进程（如果有）
    const task = activeTasks.get(taskId);
    if (task && task.process) {
      console.log(`[${new Date().toLocaleString()}] 停止运行中的进程: ${taskId}`);
      task.process.kill();
      activeTasks.delete(taskId);
      console.log(`[${new Date().toLocaleString()}] 进程已停止并从活动任务中移除`);
    }

    // 从数据库中删除任务记录
    console.log(`[${new Date().toLocaleString()}] 开始删除数据库记录`);
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM tasks WHERE id = ?', [taskId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[${new Date().toLocaleString()}] 任务记录已从数据库删除`);

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM task_history WHERE taskId = ?', [taskId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[${new Date().toLocaleString()}] 任务历史记录已从数据库删除`);

    // 删除下载目录中的文件
    if (taskInfo && taskInfo.outputFile) {
      // 1. 尝试使用完整路径
      let downloadPath = taskInfo.outputFile;
      if (!fs.existsSync(downloadPath)) {
        // 2. 如果完整路径不存在，尝试在downloads目录中查找
        downloadPath = path.join(__dirname, 'downloads', path.basename(taskInfo.outputFile));
      }

      console.log(`[${new Date().toLocaleString()}] 尝试删除下载文件: ${downloadPath}`);
      try {
        if (fs.existsSync(downloadPath)) {
          fs.unlinkSync(downloadPath);
          console.log(`[${new Date().toLocaleString()}] 成功删除下载文件: ${downloadPath}`);
        } else {
          console.log(`[${new Date().toLocaleString()}] 下载文件不存在: ${downloadPath}`);
        }
      } catch (error) {
        console.error(`[${new Date().toLocaleString()}] 删除下载文件失败: ${downloadPath}`, error);
      }

      // 删除临时目录
      const fileName = path.basename(taskInfo.outputFile);
      const tempDirName = fileName.replace(/\.[^/.]+$/, '');
      const tempPath = path.join(__dirname, 'temp', tempDirName);
      console.log(`[${new Date().toLocaleString()}] 尝试删除临时目录: ${tempPath}`);
      try {
        if (fs.existsSync(tempPath)) {
          fs.rmSync(tempPath, { recursive: true, force: true });
          console.log(`[${new Date().toLocaleString()}] 成功删除临时目录: ${tempPath}`);
        } else {
          console.log(`[${new Date().toLocaleString()}] 临时目录不存在: ${tempPath}`);
        }
      } catch (error) {
        console.error(`[${new Date().toLocaleString()}] 删除临时目录失败: ${tempPath}`, error);
      }
    } else {
      console.log(`[${new Date().toLocaleString()}] 任务没有关联的输出文件`);
    }

    console.log(`[${new Date().toLocaleString()}] 任务删除操作完成: ${taskId}`);
    res.json({ message: '任务已删除' });
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] 删除任务失败:`, error);
    res.status(500).json({ message: '删除任务失败', error: error.message });
  }
});

// 获取文件下载链接
app.get('/api/download/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { token } = req.query;

  // 验证 token
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    // 验证 JWT token，使用环境变量或默认值
    const user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!user) {
      return res.status(401).json({ error: '无效的认证令牌' });
    }

    console.log(`[${new Date().toLocaleString()}] 开始下载任务: ${taskId}`);

    // 从数据库中获取任务信息
    const tasks = await getAllTasks(user.username, user.role === 'admin');
    const task = tasks.find(t => t.id === taskId);

    if (!task || !task.outputFile) {
      console.error(`[${new Date().toLocaleString()}] 任务未找到: ${taskId}`);
      return res.status(404).json({ error: '文件未找到' });
    }

    // 使用绝对路径
    const absolutePath = path.resolve(task.outputFile);
    console.log(`[${new Date().toLocaleString()}] 文件路径: ${absolutePath}`);

    // 获取实际文件路径
    const getActualFilePath = (filePath) => {
      const dir = path.dirname(filePath);
      const baseNameWithoutExt = path.basename(filePath, path.extname(filePath));

      // 读取目录下所有文件
      const files = fs.readdirSync(dir);

      // 查找匹配的文件
      const actualFile = files.find(file =>
        path.basename(file, path.extname(file)) === baseNameWithoutExt
      );

      return actualFile ? path.join(dir, actualFile) : null;
    };

    const actualPath = getActualFilePath(absolutePath);
    if (!actualPath) {
      console.error(`[${new Date().toLocaleString()}] 文件不存在: ${absolutePath}`);
      return res.status(404).json({ error: '文件不存在' });
    }

    // 获取文件名和大小
    const fileName = path.basename(actualPath);
    const fileSize = fs.statSync(actualPath).size;
    if (fileSize === 0) {
      console.error(`[${new Date().toLocaleString()}] 文件大小为0: ${actualPath}`);
      return res.status(404).json({ error: '文件大小为0' });
    }

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileSize);

    // 创建文件读取流并发送
    const fileStream = fs.createReadStream(actualPath);

    fileStream.on('error', (error) => {
      console.error(`[${new Date().toLocaleString()}] 文件传输错误:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: '文件传输失败' });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] 下载处理错误:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: '下载处理失败' });
    }
  }
});

app.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`服务器运行在 http://${displayHost}:${port}`);
  console.log(`实际监听地址: http://${host}:${port}`);

  // 确保默认下载目录存在
  ensureDownloadDir('./downloads');
});
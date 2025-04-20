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
  updateTaskTempDir,
  getAllTasks,
  addTaskHistory,
  getTaskHistory
} = require(path.join(__dirname, 'models', 'database'));
const iptvService = require(path.join(__dirname, 'services', 'iptvService'));
const iptvRoutes = require(path.join(__dirname, 'routes', 'iptvRoutes'));
const authRoutes = require(path.join(__dirname, 'routes', 'auth'));
const dashboardRoutes = require(path.join(__dirname, 'routes', 'dashboard'));
const userRoutes = require(path.join(__dirname, 'routes', 'users'));
const taskRoutes = require(path.join(__dirname, 'routes', 'tasks'));
const settingsRoutes = require(path.join(__dirname, 'routes', 'settings'));
const batchRoutes = require(path.join(__dirname, 'routes', 'batch'));
const { validateUser, getUser, registerUser } = require(path.join(__dirname, 'models', 'userDb'));

const app = express();
const port = process.env.PORT || 3001;
const host = process.env.HOST || 'localhost';
const wsPort = process.env.WS_PORT || 3002;

// 获取系统环境变量
const processEnv = process.env;

// 导入CORS中间件
const corsMiddleware = require('./middleware/cors');

// 检查是否使用简化版CORS配置
const useSimpleCors = process.env.SIMPLE_CORS === 'true';

// 在所有中间件之前应用CORS中间件
// 这是最重要的一步，确保CORS头部在所有响应中都存在
app.use(corsMiddleware);

// 如果使用简化版CORS，添加一个全局中间件来处理所有请求
if (useSimpleCors) {
  console.log('使用简化版CORS配置，允许所有来源的请求');
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 初始化IPTV服务
iptvService.init().catch(console.error);

// 路由配置
app.use('/api/iptv', iptvRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/batch', authenticateToken, batchRoutes);

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

// 登录和注册路由已移至auth.js模块

// 刷新token路由已移至auth.js模块

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

// 将activeTasks暴露为全局变量，便于其他模块访问
global.activeTasks = activeTasks;

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
// 将messageBuffer暴露为全局变量，便于其他模块访问
global.messageBuffer = messageBuffer;
const MESSAGE_BATCH_INTERVAL = 100; // 100ms发送一次消息，原来是200ms

// 实时文件大小更新间隔（毫秒）
const FILE_SIZE_UPDATE_INTERVAL = 2000; // 2秒检查一次文件大小变化

// 定期检查文件大小并更新
setInterval(() => {
  // 遍历所有活动任务
  for (const [taskId, task] of activeTasks.entries()) {
    if (task.status === 'running' && task.outputFile) {
      try {
        // 检查文件是否存在
        let fileExists = false;
        let currentFileSize = 0;
        let actualFilePath = task.outputFile;

        // 直接检查指定文件
        if (fs.existsSync(task.outputFile)) {
          fileExists = true;
          currentFileSize = fs.statSync(task.outputFile).size;
        } else {
          // 尝试查找匹配的文件名（不包含扩展名）
          const dir = path.dirname(task.outputFile);
          if (fs.existsSync(dir)) {
            const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));
            const files = fs.readdirSync(dir);
            const matchingFile = files.find(file =>
              path.basename(file, path.extname(file)) === baseNameWithoutExt
            );

            if (matchingFile) {
              actualFilePath = path.join(dir, matchingFile);
              fileExists = true;
              currentFileSize = fs.statSync(actualFilePath).size;
            }
          }
        }

        // 如果文件存在且大小已变化，则更新
        if (fileExists && (task.lastKnownFileSize === undefined || task.lastKnownFileSize !== currentFileSize)) {
          // 保存当前文件大小
          task.lastKnownFileSize = currentFileSize;
          task.fileSize = currentFileSize;

          // 使用格式化文件大小的辅助函数
          const formattedSize = formatFileSize(currentFileSize);

          // 向所有订阅该任务的客户端发送文件大小更新消息
          for (const [ws, subscribedTaskId] of wsConnections.entries()) {
            if (subscribedTaskId === taskId && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'file_size_update',
                taskId,
                fileSize: currentFileSize,
                formattedSize,
                filePath: actualFilePath
              }));
            }
          }

          // 更新数据库中的任务信息
          updateTaskFileSize(taskId, currentFileSize).catch(err => {
            console.error(`更新任务 ${taskId} 的文件大小到数据库失败:`, err);
          });

          console.log(`任务 ${taskId} 文件大小已更新: ${formattedSize}, 路径: ${actualFilePath}`);
        }
      } catch (error) {
        console.error(`更新任务 ${taskId} 的文件大小失败:`, error);
      }
    }
  }
}, FILE_SIZE_UPDATE_INTERVAL);

// 更新任务文件大小到数据库
async function updateTaskFileSize(taskId, fileSize) {
  try {
    // 直接使用SQLite原生方法只更新文件大小
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE tasks SET fileSize = ? WHERE id = ?',
        [fileSize, taskId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  } catch (error) {
    console.error(`更新任务 ${taskId} 的文件大小到数据库失败:`, error);
    return false;
  }
}

// 格式化文件大小的辅助函数
function formatFileSize(size) {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

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

    // 生成并保存临时目录路径
    const saveName = options['save-name'] || 'output';
    const tempDirPath = path.join(tmpDir, saveName);
    await updateTaskTempDir(taskId, tempDirPath);
    console.log(`[${new Date().toLocaleString()}] 保存任务临时目录路径:`, tempDirPath);

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

    // 处理每个任务，获取实时文件大小
    for (const task of tasks) {
      if (task.status === 'running' && task.outputFile) {
        try {
          // 检查文件是否存在
          if (fs.existsSync(task.outputFile)) {
            // 获取实时文件大小
            const fileSize = fs.statSync(task.outputFile).size;
            // 更新任务记录中的文件大小
            task.fileSize = fileSize;
            // 异步更新数据库中的文件大小（不等待完成）
            updateTaskOutput(task.id, task.outputFile, fileSize).catch(console.error);
          } else {
            // 尝试查找匹配的文件名（不包含扩展名）
            const dir = path.dirname(task.outputFile);
            const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));

            try {
              // 确保目录存在
              if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                // 查找匹配的文件名
                const matchingFile = files.find(file =>
                  path.basename(file, path.extname(file)) === baseNameWithoutExt
                );

                if (matchingFile) {
                  const actualPath = path.join(dir, matchingFile);
                  const fileSize = fs.statSync(actualPath).size;
                  task.fileSize = fileSize;
                  // 异步更新数据库
                  updateTaskOutput(task.id, actualPath, fileSize).catch(console.error);
                }
              }
            } catch (err) {
              console.error(`获取目录内容失败: ${dir}`, err);
            }
          }
        } catch (error) {
          console.error(`获取任务 ${task.id} 的实时文件大小失败:`, error);
        }
      }
    }

    res.json(tasks);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ message: '获取任务列表失败' });
  }
});

// 获取任务的实时文件大小
app.get('/api/tasks/:taskId/file-size', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const isAdmin = req.user.role === 'admin';

    // 获取任务信息
    const tasks = await getAllTasks(req.user.username, isAdmin);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      return res.status(404).json({ message: '任务不存在' });
    }

    // 如果有输出文件，获取实时文件大小
    if (task.outputFile) {
      try {
        // 获取实际文件路径
        const dir = path.dirname(task.outputFile);
        const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));
        const files = fs.readdirSync(dir);
        const actualFile = files.find(file => path.basename(file, path.extname(file)) === baseNameWithoutExt);

        if (actualFile) {
          const actualFilePath = path.join(dir, actualFile);
          const fileSize = fs.statSync(actualFilePath).size;

          // 更新数据库中的文件大小
          await updateTaskOutput(taskId, actualFilePath, fileSize);

          return res.json({ fileSize });
        }
      } catch (error) {
        console.error(`获取文件大小失败: ${task.outputFile}`, error);
      }
    }

    // 如果无法获取实时文件大小，返回数据库中的大小
    res.json({ fileSize: task.fileSize || 0 });
  } catch (error) {
    console.error('获取文件大小失败:', error);
    res.status(500).json({ message: '获取文件大小失败' });
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
  console.log(`[${new Date().toLocaleString()}] 收到删除任务请求: ${req.params.taskId}`);
  console.log(`[${new Date().toLocaleString()}] 请求用户: ${req.user.username}, 角色: ${req.user.role}`);
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
      tempDir: taskInfo.tempDir,
      status: taskInfo.status
    });

    // 停止正在运行的进程（如果有）
    const task = activeTasks.get(taskId);
    if (task && task.process) {
      console.log(`[${new Date().toLocaleString()}] 停止运行中的进程: ${taskId}`);
      try {
        // Windows下使用taskkill强制结束进程树
        spawn('taskkill', ['/pid', task.process.pid, '/f', '/t']);
      } catch (killError) {
        console.error(`[${new Date().toLocaleString()}] 停止进程失败:`, killError);
        // 尝试使用普通方式结束进程
        try {
          task.process.kill();
        } catch (e) {
          console.error(`[${new Date().toLocaleString()}] 普通方式结束进程也失败:`, e);
        }
      }
      activeTasks.delete(taskId);
      console.log(`[${new Date().toLocaleString()}] 进程已停止并从活动任务中移除`);
    }

    // 删除下载目录中的文件
    if (taskInfo && taskInfo.outputFile) {
      // 尝试删除输出文件
      try {
        // 1. 尝试使用完整路径
        let downloadPath = taskInfo.outputFile;
        console.log(`[${new Date().toLocaleString()}] 检查文件路径: ${downloadPath}`);

        // 检查文件是否存在
        let fileExists = fs.existsSync(downloadPath);
        console.log(`[${new Date().toLocaleString()}] 文件是否存在: ${fileExists}`);

        if (!fileExists) {
          // 2. 如果完整路径不存在，尝试在downloads目录中查找
          downloadPath = path.join(__dirname, 'downloads', path.basename(taskInfo.outputFile));
          console.log(`[${new Date().toLocaleString()}] 尝试备用路径: ${downloadPath}`);
          fileExists = fs.existsSync(downloadPath);
          console.log(`[${new Date().toLocaleString()}] 备用路径文件是否存在: ${fileExists}`);
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
      // 首先检查数据库中保存的临时目录路径
      let tempPath = taskInfo.tempDir;

      // 如果数据库中没有保存临时目录路径，尝试从文件名推断
      if (!tempPath && taskInfo.outputFile) {
        const fileName = path.basename(taskInfo.outputFile);
        const tempDirName = fileName.replace(/\.[^/.]+$/, '');
        tempPath = path.join(__dirname, 'temp', tempDirName);
        console.log(`[${new Date().toLocaleString()}] 从文件名推断的临时目录路径: ${tempPath}`);
      } else {
        console.log(`[${new Date().toLocaleString()}] 使用数据库中保存的临时目录路径: ${tempPath}`);
      }

      if (tempPath) {
        console.log(`[${new Date().toLocaleString()}] 尝试删除临时目录: ${tempPath}`);
        console.log(`[${new Date().toLocaleString()}] 临时目录是否存在: ${fs.existsSync(tempPath)}`);

        try {
          if (fs.existsSync(tempPath)) {
            // 列出目录内容
            const dirContents = fs.readdirSync(tempPath);
            console.log(`[${new Date().toLocaleString()}] 临时目录内容:`, dirContents);

            // 检查文件权限
            try {
              fs.accessSync(tempPath, fs.constants.W_OK);
              console.log(`[${new Date().toLocaleString()}] 有写入权限`);
            } catch (err) {
              console.error(`[${new Date().toLocaleString()}] 没有写入权限:`, err);
            }

            fs.rmSync(tempPath, { recursive: true, force: true });
            console.log(`[${new Date().toLocaleString()}] 成功删除临时目录: ${tempPath}`);
          } else {
            console.log(`[${new Date().toLocaleString()}] 临时目录不存在: ${tempPath}`);
          }
        } catch (error) {
          console.error(`[${new Date().toLocaleString()}] 删除临时目录失败: ${tempPath}`, error);
        }
      } else {
        console.log(`[${new Date().toLocaleString()}] 没有找到临时目录路径`);
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
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');

const app = express();
const port = 3001;

// 获取系统环境变量
const processEnv = process.env;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());

// 静态文件服务配置
// 将 /downloads 路由映射到实际的下载目录
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

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
const wss = new WebSocket.Server({ port: 3002 });

// 存储WebSocket连接和任务ID的映射
const wsConnections = new Map();

wss.on('connection', (ws) => {
  console.log('WebSocket客户端已连接');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        // 订阅特定任务的输出
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

  ws.on('close', () => {
    wsConnections.delete(ws);
    console.log('WebSocket客户端已断开');
  });
});

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
app.post('/api/start-recording', (req, res) => {
  const { url, options } = req.body;
  const taskId = Date.now().toString();
  
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
  
  // 存储任务信息
  const outputFile = path.join(options['save-dir'], options['save-name'] || 'output.ts');
  activeTasks.set(taskId, {
    process: childProcess,
    url,
    options,
    startTime: new Date(),
    status: 'running',
    cmdStr,
    outputFile,
    saveDir: options['save-dir'],
    outputHistory: '' // 存储历史输出
  });
  
  // 处理进程输出
  childProcess.stdout.on('data', (data) => {
    const output = iconv.decode(data, 'gb2312');
    console.log(`任务 ${taskId} 输出:`, output.trim());
    
    // 更新任务的历史输出
    const task = activeTasks.get(taskId);
    if (task) {
      task.outputHistory += output;
    }
    
    // 广播到订阅的客户端
    broadcastTaskOutput(taskId, output.trim());
    
    // 检查输出中是否包含保存文件名信息
    const saveNameMatch = output.match(/保存文件名: (.+)/);
    if (saveNameMatch && task) {
      const actualFileName = saveNameMatch[1];
      task.outputFile = path.join(task.saveDir, `${actualFileName}.ts`);
      console.log(`任务 ${taskId} 更新实际输出文件路径:`, task.outputFile);
    }
    
    // 获取文件大小
    const fileSize = task ? getFileSize(task.outputFile) : 0;
    
    // 广播进度更新
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'progress',
          taskId,
          output: output.trim(),
          fileSize
        }));
      }
    });
  });
  
  // 处理进程错误
  childProcess.stderr.on('data', (data) => {
    const error = iconv.decode(data, 'gb2312');
    console.error(`任务 ${taskId} 错误:`, error.trim());
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'progress',
          taskId,
          output: `错误: ${error.trim()}`
        }));
      }
    });
  });
  
  // 处理进程结束
  childProcess.on('close', (code) => {
    console.log(`任务 ${taskId} 结束，退出码:`, code);
    const task = activeTasks.get(taskId);
    if (task) {
      const fileSize = getFileSize(task.outputFile);
      console.log(`任务 ${taskId} 输出文件路径:`, task.outputFile);
      console.log(`任务 ${taskId} 输出文件大小:`, fileSize);
      console.log(`任务 ${taskId} 保存目录:`, task.saveDir);
      
      // 检查文件是否存在
      console.log(`任务 ${taskId} 文件是否存在:`, fs.existsSync(task.outputFile));
      // 列出保存目录中的文件
      console.log(`任务 ${taskId} 保存目录内容:`, fs.readdirSync(task.saveDir));
      
      let status = 'failed';
      if (fileSize > 0) {
        status = task.status === 'stopped' ? 'paused' : 'completed';
      }
      task.status = status;
      task.fileSize = fileSize;
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'status',
            taskId,
            status,
            fileSize,
            outputFile: task.outputFile
          }));
        }
      });
    }
  });
  
  res.json({ taskId });
});

// 获取任务状态的API
app.get('/api/tasks', (req, res) => {
  const tasks = Array.from(activeTasks.entries()).map(([id, task]) => ({
    id,
    url: task.url,
    status: task.status,
    startTime: task.startTime,
    options: task.options,
    command: task.cmdStr,
    outputFile: task.outputFile,
    fileSize: getFileSize(task.outputFile)
  }));
  res.json(tasks);
});

// 获取文件下载链接
app.get('/api/download/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);
  
  if (!task || !task.outputFile) {
    return res.status(404).json({ error: '文件未找到' });
  }

  // 获取文件名
  const fileName = path.basename(task.outputFile);
  
  // 检查文件是否存在
  if (!fs.existsSync(task.outputFile)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  // 获取文件大小
  const fileSize = fs.statSync(task.outputFile).size;
  if (fileSize === 0) {
    return res.status(404).json({ error: '文件大小为0' });
  }

  // 设置响应头
  res.setHeader('Content-Type', 'video/MP2T');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', fileSize);

  // 创建文件读取流并传输给客户端
  const fileStream = fs.createReadStream(task.outputFile);
  fileStream.pipe(res);
});

// 停止录制的API
app.post('/api/stop-recording/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);
  
  if (task && task.process) {
    task.status = 'stopped';  // 标记任务为已停止
    task.process.kill();      // 结束进程
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '任务未找到' });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
  
  // 确保默认下载目录存在
  ensureDownloadDir('./downloads');
});
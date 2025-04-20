#!/usr/bin/env node

/**
 * 视频流录制工具一键启动脚本
 * 用于同时启动前端和后端服务
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 获取颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 获取本机IP地址
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// 日志输出函数
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  switch (type) {
    case 'error':
      prefix = `${colors.red}[错误]${colors.reset}`;
      break;
    case 'success':
      prefix = `${colors.green}[成功]${colors.reset}`;
      break;
    case 'warn':
      prefix = `${colors.yellow}[警告]${colors.reset}`;
      break;
    case 'backend':
      prefix = `${colors.cyan}[后端]${colors.reset}`;
      break;
    case 'frontend':
      prefix = `${colors.magenta}[前端]${colors.reset}`;
      break;
    default:
      prefix = `${colors.blue}[信息]${colors.reset}`;
  }
  
  console.log(`${prefix} ${timestamp} ${message}`);
}

// 检查必要文件和目录
function checkEnvironment() {
  log('检查环境配置...');
  
  // 检查后端.env文件
  const backendEnvPath = path.join(process.cwd(), 'backend', '.env');
  if (!fs.existsSync(backendEnvPath)) {
    log('未找到后端.env文件，将创建默认配置', 'warn');
    const backendEnv = `PORT=3001\nHOST=0.0.0.0\nWS_PORT=3002\nJWT_SECRET=your-secret-key\nTOKEN_EXPIRE=24h`;
    fs.writeFileSync(backendEnvPath, backendEnv);
    log('已创建后端默认.env文件', 'success');
  }
  
  // 检查前端.env文件
  const frontendEnvPath = path.join(process.cwd(), 'frontend', '.env');
  if (!fs.existsSync(frontendEnvPath)) {
    log('未找到前端.env文件，将创建默认配置', 'warn');
    const localIp = getLocalIp();
    const frontendEnv = `VITE_HOST=0.0.0.0\nVITE_PORT=3005\nVITE_API_BASE_URL=http://${localIp}:3001\nVITE_WS_URL=ws://${localIp}:3002\nVITE_ALLOWED_HOSTS=${localIp},localhost`;
    fs.writeFileSync(frontendEnvPath, frontendEnv);
    log('已创建前端默认.env文件', 'success');
  }
  
  // 检查N_m3u8DL-RE可执行文件
  const exeName = process.platform === 'win32' ? 'Sever.exe' : 'Sever';
  const exePath = path.join(process.cwd(), exeName);
  if (!fs.existsSync(exePath)) {
    log(`未找到${exeName}文件，请确保N_m3u8DL-RE可执行文件位于项目根目录`, 'warn');
    log(`您可以从 https://github.com/nilaoda/N_m3u8DL-RE/releases 下载最新版本`, 'warn');
  } else {
    log(`N_m3u8DL-RE可执行文件检查通过`, 'success');
  }
  
  // 检查必要目录
  const dirs = [
    path.join(process.cwd(), 'backend', 'downloads'),
    path.join(process.cwd(), 'backend', 'temp'),
    path.join(process.cwd(), 'backend', 'data'),
    path.join(process.cwd(), 'logs')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`创建目录: ${dir}`, 'success');
    }
  });
  
  log('环境检查完成', 'success');
}

// 启动后端服务
function startBackend() {
  return new Promise((resolve) => {
    log('正在启动后端服务...');
    const backendCwd = path.resolve(process.cwd(), 'backend');
    
    // 读取后端端口
    let backendPort = 3001;
    try {
      const envContent = fs.readFileSync(path.join(backendCwd, '.env'), 'utf8');
      const portMatch = envContent.match(/PORT=(\d+)/);
      if (portMatch && portMatch[1]) {
        backendPort = portMatch[1];
      }
    } catch (error) {
      log('读取后端端口失败，将使用默认端口3001', 'warn');
    }
    
    const backendProcess = spawn('node', ['server.js'], {
      cwd: backendCwd,
      shell: true
    });
    
    backendProcess.stdout.on('data', (data) => {
      data.toString().split('\n').filter(line => line.trim()).forEach(line => {
        log(line, 'backend');
      });
    });
    
    backendProcess.stderr.on('data', (data) => {
      data.toString().split('\n').filter(line => line.trim()).forEach(line => {
        log(line, 'error');
      });
    });
    
    backendProcess.on('error', (err) => {
      log(`启动后端服务失败: ${err.message}`, 'error');
      resolve(false);
    });
    
    // 等待几秒确认服务启动
    setTimeout(() => {
      log(`后端服务运行于 http://localhost:${backendPort}`, 'success');
      resolve(true);
    }, 2000);
  });
}

// 启动前端服务
function startFrontend() {
  return new Promise((resolve) => {
    log('正在启动前端服务...');
    const frontendCwd = path.resolve(process.cwd(), 'frontend');
    
    // 读取前端端口
    let frontendPort = 3005;
    try {
      const envContent = fs.readFileSync(path.join(frontendCwd, '.env'), 'utf8');
      const portMatch = envContent.match(/VITE_PORT=(\d+)/);
      if (portMatch && portMatch[1]) {
        frontendPort = portMatch[1];
      }
    } catch (error) {
      log('读取前端端口失败，将使用默认端口3005', 'warn');
    }
    
    const frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: frontendCwd,
      shell: true
    });
    
    frontendProcess.stdout.on('data', (data) => {
      data.toString().split('\n').filter(line => line.trim()).forEach(line => {
        // 只输出关键信息，减少日志量
        if (line.includes('localhost:') || line.includes('error') || line.includes('ready')) {
          log(line, 'frontend');
        }
      });
    });
    
    frontendProcess.stderr.on('data', (data) => {
      data.toString().split('\n').filter(line => line.trim()).forEach(line => {
        log(line, 'error');
      });
    });
    
    frontendProcess.on('error', (err) => {
      log(`启动前端服务失败: ${err.message}`, 'error');
      resolve(false);
    });
    
    // 等待一段时间确认前端服务启动
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      if (checkCount >= 30) { // 最多等待30秒
        clearInterval(checkInterval);
        log('前端服务启动超时，请检查日志', 'warn');
        resolve(false);
        return;
      }
      
      // 使用简单的http请求检查前端服务是否启动
      const http = require('http');
      const url = `http://localhost:${frontendPort}`;
      
      const req = http.get(url, (res) => {
        clearInterval(checkInterval);
        log(`前端服务运行于 ${url}`, 'success');
        resolve(true);
      });
      
      req.on('error', (err) => {
        // 继续等待，前端服务可能还在启动中
      });
      
      req.end();
    }, 1000);
  });
}

// 显示访问信息
function showAccessInfo() {
  const localIp = getLocalIp();
  let frontendPort = 3005;
  
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), 'frontend', '.env'), 'utf8');
    const portMatch = envContent.match(/VITE_PORT=(\d+)/);
    if (portMatch && portMatch[1]) {
      frontendPort = portMatch[1];
    }
  } catch (error) {
    // 使用默认端口
  }
  
  console.log('\n========================================');
  console.log(`${colors.bright}${colors.green}服务已成功启动!${colors.reset}`);
  console.log('----------------------------------------');
  console.log(`${colors.cyan}本地访问地址: ${colors.reset}http://localhost:${frontendPort}`);
  console.log(`${colors.cyan}网络访问地址: ${colors.reset}http://${localIp}:${frontendPort}`);
  console.log('========================================\n');
  console.log(`${colors.yellow}提示: 按下 Ctrl+C 可以停止所有服务${colors.reset}\n`);
}

// 主函数
async function main() {
  console.log('\n====== 视频流录制工具一键启动脚本 ======\n');
  
  // 检查环境
  checkEnvironment();
  
  // 启动后端
  const backendStarted = await startBackend();
  
  // 启动前端
  if (backendStarted) {
    const frontendStarted = await startFrontend();
    
    if (frontendStarted) {
      showAccessInfo();
    } else {
      log('前端服务启动失败，请检查错误日志', 'error');
    }
  } else {
    log('后端服务启动失败，无法继续启动前端', 'error');
  }
  
  // 设置进程结束处理
  process.on('SIGINT', () => {
    log('正在关闭所有服务...', 'warn');
    
    // 在Windows上尝试终止Node进程
    if (process.platform === 'win32') {
      try {
        exec('taskkill /F /IM node.exe', () => {
          log('服务已停止', 'success');
          process.exit(0);
        });
      } catch (error) {
        log('无法正常停止服务，请手动关闭', 'error');
        process.exit(1);
      }
    } else {
      // 在类Unix系统上通过信号终止
      log('服务已停止', 'success');
      process.exit(0);
    }
  });
}

// 执行主函数
main().catch(err => {
  log(`启动过程中出错: ${err.message}`, 'error');
}); 
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const readline = require('readline');
const os = require('os');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// 创建目录
function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
}

// 创建环境变量文件
function createEnvFile(filePath, content) {
  fs.writeFileSync(filePath, content);
  console.log(`创建配置文件: ${filePath}`);
}

// 安装依赖
async function installDependencies(dir) {
  console.log(`\n正在安装 ${dir} 的依赖，这可能需要几分钟...`);
  return new Promise((resolve, reject) => {
    const npmInstall = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['install'], {
      cwd: path.join(process.cwd(), dir),
      stdio: 'inherit'
    });

    npmInstall.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${dir} 依赖安装成功`);
        resolve();
      } else {
        console.error(`❌ ${dir} 依赖安装失败`);
        reject();
      }
    });
  });
}

// 初始化管理员账户
function initAdmin(username, password) {
  return new Promise((resolve, reject) => {
    createDirIfNotExists('./backend/data');
    
    try {
      // 修改管理员初始化脚本
      const adminScriptPath = path.join(process.cwd(), 'backend', 'scripts', 'init-admin.js');
      if (fs.existsSync(adminScriptPath)) {
        let adminScript = fs.readFileSync(adminScriptPath, 'utf8');
        adminScript = adminScript.replace(
          /username: ['"]admin['"],\s*\/\/\s*在这里修改管理员用户名/,
          `username: '${username}',  // 在这里修改管理员用户名`
        );
        adminScript = adminScript.replace(
          /password: ['"]admin123['"],\s*\/\/\s*在这里修改管理员密码/,
          `password: '${password}',  // 在这里修改管理员密码`
        );
        fs.writeFileSync(adminScriptPath, adminScript);
      }

      const initAdminProcess = spawn(/^win/.test(process.platform) ? 'node.cmd' : 'node', 
        ['scripts/init-admin.js'], {
        cwd: path.join(process.cwd(), 'backend'),
        stdio: 'inherit'
      });

      initAdminProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 管理员账户初始化成功');
          resolve();
        } else {
          console.error('❌ 管理员账户初始化失败');
          reject();
        }
      });
    } catch (error) {
      console.error('初始化管理员时出错:', error);
      reject(error);
    }
  });
}

// 下载N_m3u8DL-RE可执行文件
async function downloadN_m3u8DLRE() {
  console.log('\n检查N_m3u8DL-RE可执行文件...');
  const exeName = process.platform === 'win32' ? 'Sever.exe' : 'Sever';
  const exePath = path.join(process.cwd(), exeName);

  if (fs.existsSync(exePath)) {
    console.log('✅ N_m3u8DL-RE可执行文件已存在');
    return;
  }

  console.log('N_m3u8DL-RE可执行文件不存在，正在尝试下载...');
  console.log('请前往 https://github.com/nilaoda/N_m3u8DL-RE/releases 下载最新版本');
  console.log('下载后，请将Sever.exe或Sever文件放到项目根目录');
  
  return new Promise((resolve) => {
    rl.question('\n是否已经下载并放置好文件？(y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        if (fs.existsSync(exePath)) {
          console.log('✅ 检测到N_m3u8DL-RE可执行文件');
          resolve();
        } else {
          console.log('❌ 未检测到N_m3u8DL-RE可执行文件，请确保文件位于项目根目录');
          process.exit(1);
        }
      } else {
        console.log('请下载N_m3u8DL-RE可执行文件后再运行此脚本');
        process.exit(1);
      }
    });
  });
}

// 启动服务
function startServices() {
  return new Promise((resolve) => {
    rl.question('\n是否立即启动服务？(y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        console.log('\n启动后端服务...');
        const backendProcess = spawn(/^win/.test(process.platform) ? 'node.cmd' : 'node', ['server.js'], {
          cwd: path.join(process.cwd(), 'backend'),
          detached: true,
          stdio: 'inherit'
        });
        
        console.log('\n启动前端服务...');
        const frontendProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], {
          cwd: path.join(process.cwd(), 'frontend'),
          detached: true,
          stdio: 'inherit'
        });
        
        console.log('\n服务已启动！请访问前端服务地址(通常是 http://localhost:3005)');
        resolve();
      } else {
        console.log('\n您可以手动启动服务:');
        console.log('后端: cd backend && node server.js');
        console.log('前端: cd frontend && npm run dev');
        resolve();
      }
    });
  });
}

// 更新README.md添加变更记录
function updateReadme() {
  try {
    const readmePath = path.join(process.cwd(), 'README.md');
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      const today = new Date().toISOString().slice(0, 10);
      
      // 检查是否已有今天的变更记录
      if (!readme.includes(`### ${today}`)) {
        const changeLog = `\n### ${today}\n- 使用一键部署脚本安装并配置系统\n- 自动创建所需目录和环境配置\n- 初始化管理员账户\n`;
        
        // 在变更记录部分添加新记录
        if (readme.includes('## 变更记录')) {
          readme = readme.replace('## 变更记录', '## 变更记录' + changeLog);
        } else {
          readme += '\n## 变更记录' + changeLog;
        }
        
        fs.writeFileSync(readmePath, readme);
        console.log('✅ README.md 变更记录已更新');
      }
    }
  } catch (error) {
    console.error('更新README.md时出错:', error);
  }
}

// 主函数
async function main() {
  console.log('\n=== 视频流录制工具一键部署脚本 ===\n');
  
  // 创建必要的目录
  createDirIfNotExists('./backend/downloads');
  createDirIfNotExists('./backend/temp');
  createDirIfNotExists('./backend/data');
  createDirIfNotExists('./logs');
  
  // 获取本机IP
  const localIp = getLocalIp();
  console.log(`检测到本机IP: ${localIp}`);
  
  // 获取管理员账户信息
  let adminUsername = 'admin';
  let adminPassword = 'admin123';
  
  await new Promise((resolve) => {
    rl.question('\n请设置管理员用户名 (默认: admin): ', (answer) => {
      if (answer.trim()) {
        adminUsername = answer.trim();
      }
      resolve();
    });
  });
  
  await new Promise((resolve) => {
    rl.question('请设置管理员密码 (默认: admin123): ', (answer) => {
      if (answer.trim()) {
        adminPassword = answer.trim();
      }
      resolve();
    });
  });
  
  // 获取端口配置
  let backendPort = '3001';
  let frontendPort = '3005';
  let wsPort = '3002';
  
  await new Promise((resolve) => {
    rl.question(`请设置后端端口 (默认: 3001): `, (answer) => {
      if (answer.trim()) {
        backendPort = answer.trim();
      }
      resolve();
    });
  });
  
  await new Promise((resolve) => {
    rl.question(`请设置前端端口 (默认: 3005): `, (answer) => {
      if (answer.trim()) {
        frontendPort = answer.trim();
      }
      resolve();
    });
  });
  
  await new Promise((resolve) => {
    rl.question(`请设置WebSocket端口 (默认: 3002): `, (answer) => {
      if (answer.trim()) {
        wsPort = answer.trim();
      }
      resolve();
    });
  });
  
  // 创建后端环境变量文件
  const backendEnv = `PORT=${backendPort}\nHOST=0.0.0.0\nWS_PORT=${wsPort}\nJWT_SECRET=your-secret-key\nTOKEN_EXPIRE=24h`;
  createEnvFile(path.join(process.cwd(), 'backend', '.env'), backendEnv);
  
  // 创建前端环境变量文件
  const frontendEnv = `VITE_HOST=0.0.0.0\nVITE_PORT=${frontendPort}\nVITE_API_BASE_URL=http://${localIp}:${backendPort}\nVITE_WS_URL=ws://${localIp}:${wsPort}\nVITE_ALLOWED_HOSTS=${localIp},localhost`;
  createEnvFile(path.join(process.cwd(), 'frontend', '.env'), frontendEnv);
  
  try {
    // 下载N_m3u8DL-RE
    await downloadN_m3u8DLRE();
    
    // 安装依赖
    await installDependencies('backend');
    await installDependencies('frontend');
    
    // 初始化管理员账户
    await initAdmin(adminUsername, adminPassword);
    
    // 更新README.md
    updateReadme();
    
    console.log('\n✅ 部署完成！系统配置信息:');
    console.log(`管理员账户: ${adminUsername}`);
    console.log(`管理员密码: ${adminPassword}`);
    console.log(`后端地址: http://${localIp}:${backendPort}`);
    console.log(`前端地址: http://${localIp}:${frontendPort}`);
    console.log(`WebSocket: ws://${localIp}:${wsPort}`);
    
    // 启动服务
    await startServices();
  } catch (error) {
    console.error('部署过程中出错:', error);
  } finally {
    rl.close();
  }
}

// 执行主函数
main(); 
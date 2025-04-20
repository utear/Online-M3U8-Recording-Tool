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

// 备用安装方法，使用exec替代spawn
function fallbackInstall(dir) {
  return new Promise((resolve, reject) => {
    console.log(`\n尝试使用备用方法安装 ${dir} 依赖...`);
    const isWin = process.platform === 'win32';
    const cwd = path.resolve(process.cwd(), dir);
    const command = isWin ? 'npm.cmd install' : 'npm install';

    const child = require('child_process').exec(command, { cwd: cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ 备用安装方法也失败: ${error.message}`);
        console.error(`命令: ${command}`);
        console.error(`目录: ${cwd}`);
        reject(error);
        return;
      }
      console.log(`✅ ${dir} 依赖安装成功 (备用方法)`);
      resolve();
    });

    // 实时输出命令结果
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

// 安装依赖
async function installDependencies(dir) {
  console.log(`\n正在安装 ${dir} 的依赖，这可能需要几分钟...`);
  try {
    return new Promise((resolve, reject) => {
      // 修复Windows环境下的命令执行问题
      const isWin = process.platform === 'win32';
      const npm = isWin ? 'npm.cmd' : 'npm';

      try {
        // 使用更安全的路径处理方式
        const cwd = path.resolve(process.cwd(), dir);
        console.log(`执行目录: ${cwd}`);

        const npmInstall = spawn(npm, ['install'], {
          cwd: cwd,
          stdio: 'inherit',
          shell: isWin // 在Windows上使用shell模式
        });

        npmInstall.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ ${dir} 依赖安装成功`);
            resolve();
          } else {
            console.error(`❌ ${dir} 依赖安装失败，退出码: ${code}`);
            // 失败后尝试备用方法
            fallbackInstall(dir).then(resolve).catch(reject);
          }
        });

        npmInstall.on('error', (err) => {
          console.error(`❌ 启动npm进程时出错:`, err);
          // 出错后尝试备用方法
          fallbackInstall(dir).then(resolve).catch(reject);
        });
      } catch (error) {
        console.error(`❌ 安装依赖过程中发生异常:`, error);
        // 异常后尝试备用方法
        fallbackInstall(dir).then(resolve).catch(reject);
      }
    });
  } catch (finalError) {
    console.error('所有安装方法都失败，请尝试手动安装依赖');
    console.error(`cd ${dir} && npm install`);
    throw finalError;
  }
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

      // 使用更可靠的方式执行Node脚本
      const isWin = process.platform === 'win32';
      const cwd = path.resolve(process.cwd(), 'backend');
      console.log(`执行目录: ${cwd}`);

      // 使用备用方法执行脚本而不是spawn
      console.log('正在初始化管理员账户...');
      try {
        // 尝试使用require方式直接执行脚本
        const initScript = path.join(cwd, 'scripts', 'init-admin.js');
        console.log(`执行脚本: ${initScript}`);

        // 先尝试使用exec执行
        const { execSync } = require('child_process');
        const nodeCmd = isWin ? 'node' : 'node';
        execSync(`${nodeCmd} "${initScript}"`, {
          cwd: cwd,
          stdio: 'inherit'
        });

        console.log('✅ 管理员账户初始化成功');
        resolve();
      } catch (execError) {
        console.error('使用exec执行脚本失败:', execError);

        // 如果exec失败，尝试使用spawn作为后备方案
        try {
          console.log('尝试使用备用方法初始化管理员账户...');
          const node = isWin ? 'node' : 'node';

          const initAdminProcess = spawn(node, ['scripts/init-admin.js'], {
            cwd: cwd,
            stdio: 'inherit',
            shell: true // 使用shell执行，增加兼容性
          });

          initAdminProcess.on('close', (code) => {
            if (code === 0) {
              console.log('✅ 管理员账户初始化成功');
              resolve();
            } else {
              console.error(`❌ 管理员账户初始化失败，退出码: ${code}`);
              reject(new Error(`初始化管理员失败，退出码: ${code}`));
            }
          });

          initAdminProcess.on('error', (err) => {
            console.error('❌ 初始化管理员进程时出错:', err);
            reject(err);
          });
        } catch (spawnError) {
          console.error('使用spawn执行脚本也失败:', spawnError);

          // 如果spawn也失败，尝试在当前进程中直接执行代码
          try {
            console.log('尝试直接执行初始化脚本...');
            // 保存当前工作目录
            const originalCwd = process.cwd();
            // 切换到backend目录
            process.chdir(cwd);

            // 直接执行脚本内容
            require(path.join('scripts', 'init-admin.js'));

            // 恢复原始工作目录
            process.chdir(originalCwd);

            console.log('✅ 管理员账户初始化成功');
            resolve();
          } catch (requireError) {
            console.error('直接执行初始化脚本失败:', requireError);
            reject(requireError);
          }
        }
      }
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
        try {
          const isWin = process.platform === 'win32';
          // 使用通用的命令名称，而不是特定的.cmd后缀
          const node = 'node';
          const npm = 'npm';

          console.log('\n启动后端服务...');
          const backendCwd = path.resolve(process.cwd(), 'backend');
          console.log(`后端目录: ${backendCwd}`);

          // 使用更可靠的execSync方法启动
          try {
            console.log('尝试启动后端服务...');
            const backendCmd = `${node} server.js`;
            console.log(`执行命令: ${backendCmd}`);

            // 使用exec启动后端，允许后台运行
            const { exec } = require('child_process');
            const backendProcess = exec(backendCmd, {
              cwd: backendCwd,
              windowsHide: true
            });

            if (backendProcess) {
              console.log('✅ 后端服务启动成功');

              // 将输出传递到控制台
              backendProcess.stdout?.on('data', (data) => {
                console.log(`后端输出: ${data}`);
              });

              backendProcess.stderr?.on('data', (data) => {
                console.error(`后端错误: ${data}`);
              });

              // 设置进程独立运行
              backendProcess.unref();
            }
          } catch (backendError) {
            console.error('启动后端服务失败:', backendError);
          }

          console.log('\n启动前端服务...');
          const frontendCwd = path.resolve(process.cwd(), 'frontend');
          console.log(`前端目录: ${frontendCwd}`);

          // 使用更可靠的exec方法启动前端
          try {
            console.log('尝试启动前端服务...');
            const frontendCmd = `${npm} run dev`;
            console.log(`执行命令: ${frontendCmd}`);

            // 使用exec启动前端，允许后台运行
            const { exec } = require('child_process');
            const frontendProcess = exec(frontendCmd, {
              cwd: frontendCwd,
              windowsHide: true
            });

            if (frontendProcess) {
              console.log('✅ 前端服务启动成功');

              // 将输出传递到控制台
              frontendProcess.stdout?.on('data', (data) => {
                console.log(`前端输出: ${data}`);
              });

              frontendProcess.stderr?.on('data', (data) => {
                console.error(`前端错误: ${data}`);
              });

              // 设置进程独立运行
              frontendProcess.unref();
            }
          } catch (frontendError) {
            console.error('启动前端服务失败:', frontendError);
          }

          console.log('\n服务已启动！请访问前端服务地址(通常是 http://localhost:3005)');

          // 等待一些消息输出后再退出
          setTimeout(() => {
            console.log('\n部署和启动过程已完成。您可以关闭此窗口。');
            resolve();
          }, 3000);
        } catch (error) {
          console.error('❌ 启动服务时出错:', error);
          console.log('\n您可以手动启动服务:');
          console.log('后端: cd backend && node server.js');
          console.log('前端: cd frontend && npm run dev');
          resolve(); // 仍然解析Promise，让脚本能够继续完成
        }
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

  // 获取端口配置结束

  // 默认API和WebSocket URL使用本地IP
  let apiBaseUrl = `http://${localIp}:${backendPort}`;
  let wsUrl = `ws://${localIp}:${wsPort}`;

  // 准备前端允许的主机列表
  let allowedHosts = [`${localIp}`, 'localhost'];

  // CORS域名配置
  let customDomains = [];
  let addCustomDomain = false;

  await new Promise((resolve) => {
    rl.question(`\n是否需要添加自定义域名到CORS配置？(y/n, 默认: n): `, (answer) => {
      if (answer.trim().toLowerCase() === 'y') {
        addCustomDomain = true;
      }
      resolve();
    });
  });

  if (addCustomDomain) {
    console.log('\n请输入域名（不含协议和端口，如example.com）');
    console.log('多个域名请用逗号分隔');

    let inputDomains = '';
    await new Promise((resolve) => {
      rl.question('域名: ', (answer) => {
        inputDomains = answer.trim();
        resolve();
      });
    });

    if (inputDomains) {
      // 拆分并清理域名
      const cleanDomains = inputDomains.split(',')
        .map(domain => domain.trim())
        .map(domain => domain.replace(/^https?:\/\//, '').replace(/^ws:\/\//, '').replace(/:\d+$/, ''));

      // 更新allowedHosts，确保不重复
      allowedHosts = [...new Set([...allowedHosts, ...cleanDomains])];

      // 为每个域名生成URL组合
      cleanDomains.forEach(domain => {
        // 添加HTTP和WebSocket协议的URL
        customDomains.push(
          `http://${domain}:${backendPort}`,
          `http://${domain}:${frontendPort}`,
          `ws://${domain}:${wsPort}`
        );

        console.log(`为域名 ${domain} 添加以下地址到CORS配置:`);
        console.log(`- http://${domain}:${backendPort} (后端API)`);
        console.log(`- http://${domain}:${frontendPort} (前端)`);
        console.log(`- ws://${domain}:${wsPort} (WebSocket)`);
      });

      // 如果只有一个自定义域名，询问是否用它替换默认的API和WebSocket URL
      if (cleanDomains.length === 1) {
        const customDomain = cleanDomains[0];
        await new Promise((resolve) => {
          rl.question(`\n是否使用 ${customDomain} 作为API和WebSocket地址？(y/n, 默认: y): `, (answer) => {
            if (answer.trim().toLowerCase() !== 'n') {
              apiBaseUrl = `http://${customDomain}:${backendPort}`;
              wsUrl = `ws://${customDomain}:${wsPort}`;
              console.log(`\n已设置API地址为: ${apiBaseUrl}`);
              console.log(`已设置WebSocket地址为: ${wsUrl}`);
            }
            resolve();
          });
        });
      }
      // 如果有多个域名，让用户选择一个
      else if (cleanDomains.length > 1) {
        console.log('\n检测到多个域名，请选择一个作为API和WebSocket地址:');
        for (let i = 0; i < cleanDomains.length; i++) {
          console.log(`${i + 1}. ${cleanDomains[i]}`);
        }
        console.log(`${cleanDomains.length + 1}. 使用本地IP (${localIp})`);

        let selection = cleanDomains.length + 1; // 默认使用本地IP
        await new Promise((resolve) => {
          rl.question(`请选择 (1-${cleanDomains.length + 1}, 默认: ${cleanDomains.length + 1}): `, (answer) => {
            const selected = parseInt(answer.trim());
            if (!isNaN(selected) && selected >= 1 && selected <= cleanDomains.length + 1) {
              selection = selected;
            }
            resolve();
          });
        });

        // 设置选定的域名
        if (selection <= cleanDomains.length) {
          const selectedDomain = cleanDomains[selection - 1];
          apiBaseUrl = `http://${selectedDomain}:${backendPort}`;
          wsUrl = `ws://${selectedDomain}:${wsPort}`;
          console.log(`\n已设置API地址为: ${apiBaseUrl}`);
          console.log(`已设置WebSocket地址为: ${wsUrl}`);
        }
      }
    }
  }

  // 基本CORS配置
  let corsOrigins = [
    `http://localhost:${frontendPort}`,
    `http://127.0.0.1:${frontendPort}`,
    `http://${localIp}:${frontendPort}`,
    `http://localhost:${backendPort}`,
    `http://127.0.0.1:${backendPort}`,
    `http://${localIp}:${backendPort}`,
    `ws://localhost:${wsPort}`,
    `ws://127.0.0.1:${wsPort}`,
    `ws://${localIp}:${wsPort}`
  ];

  // 合并自定义域名并去重
  if (customDomains.length > 0) {
    corsOrigins = [...corsOrigins, ...customDomains];
    // 使用Set去除重复项
    corsOrigins = [...new Set(corsOrigins)];
  }

  // 创建后端环境变量文件
  const backendEnv = `PORT=${backendPort}\nHOST=0.0.0.0\nWS_PORT=${wsPort}\nJWT_SECRET=your-secret-key\nTOKEN_EXPIRE=24h\n# CORS 配置，多个域名使用逗号分隔\n# 注意：生产环境中需要包含所有可能的访问源，包括前端、后端和WebSocket地址\nCORS_ALLOWED_ORIGINS=${corsOrigins.join(',')}`;
  createEnvFile(path.join(process.cwd(), 'backend', '.env'), backendEnv);

  // 创建前端环境变量文件
  const frontendEnv = `# 前端服务器配置\nVITE_HOST=0.0.0.0  # 使用0.0.0.0允许外部访问\nVITE_PORT=${frontendPort}  # 前端服务端口\n\n# API和WebSocket地址配置\n# 注意：生产环境中应使用实际的域名或IP地址\nVITE_API_BASE_URL=${apiBaseUrl}  # 后端API地址\nVITE_WS_URL=${wsUrl}  # WebSocket地址\n\n# 允许访问的域名配置\nVITE_ALLOWED_HOSTS=${allowedHosts.join(',')}  # 多个域名用逗号分隔`;
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
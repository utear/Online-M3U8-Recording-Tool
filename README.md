# 视频流录制工具

基于 [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) 的网页版视频流录制工具，提供友好的用户界面来管理视频流（M3U/M3U8等）的录制任务。

在此对项目原作者nilaoda大佬表示衷心的感谢。

## 系统要求

- Node.js 16+
- N_m3u8DL-RE 可执行文件

## 主要功能

- 支持录制 m3u/m3u8/视频流
- 多任务并行录制，实时显示进度
- 批量录制功能，支持同时启动多个录制任务
- 任务组管理，支持批量停止和控制
- 可配置下载参数（线程数、保存目录等）
- 内置进程控制终端，支持实时交互（可能存在bug）
- 完整的文件管理机制
- IPTV直播列表自动更新机制：
  - 支持配置多个IPTV源，自动合并频道并去除重复项
  - 每个IPTV源可单独启用/禁用，支持添加、编辑和删除操作
  - 服务器端每4小时自动更新一次IPTV列表
  - 本地缓存支持，减少网络请求
  - 支持HTTP代理配置，解决GitHub访问问题
  - 默认IPTV源：https://github.com/vbskycn/iptv/blob/master/tv/iptv4.m3u
- 用户权限管理系统：
  - 支持用户注册和登录
  - 基于JWT的安全认证机制
  - 用户审核机制：
    * 新注册用户需要管理员审核后才能登录
    * 管理员可以批准或拒绝用户注册申请
    * 用户状态显示：待审核、已批准、已拒绝
  - 管理员账户功能：
    * 管理员仪表盘，实时监控系统状态
    * 用户管理，支持用户的增删改查操作
    * 待审核用户管理，快速审核新注册用户
    * 任务监控，查看所有用户的任务记录
    * 任务管理，支持任务的停止、删除和下载
    * 文件管理，支持下载文件和临时文件的管理
    * 系统设置，包括IPTV源配置和存储设置
    * 统计数据查看，用户数、活跃任务数等
  - 普通用户功能：
    * 创建和管理自己的录制任务
    * 实时查看任务进度
    * 下载已完成的录制文件
- 文件下载功能：
  - 支持大文件下载
  - 实时显示下载进度
  - 基于用户权限的访问控制
  - 自动文件完整性检查

## 图片演示（非最新版本，请以最新版本为准）
 - 用户端：
![image](https://github.com/user-attachments/assets/4f00dac2-5d2a-4be8-9e91-5c8f428a68a8)
![image](https://github.com/user-attachments/assets/3c96dca0-db66-4aae-8ea9-6348bd9093ab)
![image](https://github.com/user-attachments/assets/3ba2b1a9-ab57-4567-8767-ff03c7bda0c1)
![image](https://github.com/user-attachments/assets/ed2c63f9-1b61-4d2d-9e33-ff2a267d5fcb)
![image](https://github.com/user-attachments/assets/44d53cd5-6719-42eb-91e1-fc3cfec959ea)
![image](https://github.com/user-attachments/assets/915209d7-9338-4acf-9e29-816f9c6dbb28)
![image](https://github.com/user-attachments/assets/9e1f1607-123e-4799-976f-37c6cf18800d)
![image](https://github.com/user-attachments/assets/69f8970c-5bc0-4edc-833e-e2b35026c7e3)

 - 仪表盘：
![5415bb067a4f4c0e8e2cf211c549b30](https://github.com/user-attachments/assets/f206df11-2e9f-444f-936e-33ca57a3ac7b)
![4bf057df5daeb9acd78b4056f5a9a3f](https://github.com/user-attachments/assets/15526f5c-2303-4709-962f-c5114008ff40)
![aabb287be00789400cae85dc260c8ac](https://github.com/user-attachments/assets/e94d45ea-08cc-403e-9a84-908f88f7575f)
![012d78fa6c912f95a53f9703911bf2b](https://github.com/user-attachments/assets/23f2c25d-4ea9-4ddd-8f79-2a868f4b3f3a)
![c1f654a176faaeefc975d65804172f5](https://github.com/user-attachments/assets/479b6da8-2d3d-44c8-9be6-bc177563be85)
![bf034128da5a11b7623782e871d4929](https://github.com/user-attachments/assets/d0988dbd-1bfd-4968-9cb2-c3ff161ab04e)



## 快速开始

### 一键部署（推荐）

1. 克隆项目：
```bash
git clone https://github.com/Asheblog/N_m3u8DL-RE-web.git
cd N_m3u8DL-RE-web
```

2. 运行一键部署脚本：
```bash
# Windows系统
node setup.js

# Linux/macOS系统
chmod +x setup.js
./setup.js
```

3. 按照提示进行配置：
   - 设置管理员账户名和密码
   - 配置端口信息
   - 下载N_m3u8DL-RE可执行文件（如果尚未下载）
   - 自动安装前后端依赖
   - 自动创建必要的目录和配置文件
   - 启动服务

4. 访问：`http://本机IP:前端端口号`

### 一键启动（已部署后使用）

如果您已经完成了项目部署，可以使用一键启动脚本快速启动前后端服务：

```bash
# Windows系统
node start.js

# Linux/macOS系统
chmod +x start.js
./start.js
```

一键启动脚本会自动：
- 检查环境配置和必要文件
- 创建默认配置文件（如果不存在）
- 启动后端服务
- 启动前端服务
- 显示访问地址

启动完成后，只需在浏览器中访问提示的地址即可使用系统。按下`Ctrl+C`可以停止所有服务。

### 手动安装

1. 克隆项目：
```bash
git clone https://github.com/Asheblog/N_m3u8DL-RE-web.git
```

2. 安装依赖：
```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

3. 确保 N_m3u8DL-RE 可执行文件 (Sever.exe) 位于项目根目录

### 环境配置

在启动前，需要配置环境变量：

1. 后端配置 (`backend/.env`):
```bash
PORT=3001
HOST=0.0.0.0  # 使用 0.0.0.0 允许外部访问
WS_PORT=3002  # WebSocket服务端口
JWT_SECRET=your-secret-key  # JWT密钥，请修改为随机字符串
TOKEN_EXPIRE=24h  # Token过期时间

# CORS配置，指定允许访问的源（域名），多个源用逗号分隔
CORS_ALLOWED_ORIGINS=http://localhost:3005,http://your-domain.com:3005
```

2. 前端配置 (`frontend/.env`):
```bash
# 前端访问地址和端口配置
VITE_HOST=0.0.0.0  # 允许外部访问
VITE_PORT=3005     # 前端服务端口

# API 接口配置（根据实际部署环境修改）
VITE_API_BASE_URL=http://your-server-ip:3001  # 替换为实际的服务器地址
VITE_WS_URL=ws://your-server-ip:3002          # 替换为实际的服务器地址

# 允许访问的主机配置（解决生产环境跨域问题）
VITE_ALLOWED_HOSTS=your-domain.com,www.your-domain.com  # 多个域名用逗号分隔
```

3. HTTP代理配置（如果需要）:
在 `backend/services/iptvService.js` 中配置代理设置：
```javascript
const PROXY_CONFIG = {
    host: '127.0.0.1',  // 代理服务器地址
    port: 7890          // 代理服务器端口
};
```

注意：
- 开发环境可使用 localhost
- 生产环境请替换为实际的服务器IP或域名
- 如果服务器无法直接访问GitHub，请配置HTTP代理
- 在生产环境中，需要在 `VITE_ALLOWED_HOSTS` 中配置允许访问的域名，以解决跨域访问限制问题

### 启动

1. 启动后端服务：
```bash
cd backend
node server.js
```

2. 启动前端服务：
```bash
cd frontend
npm run dev
```

3. 访问：`http://localhost:你设定的前端端口号`

### 管理员账户设置

1. 初始化管理员账户：
```bash
cd backend
node scripts/init-admin.js
```
这将创建默认管理员账户：
- 用户名：admin
- 密码：admin123

你可以通过修改 `backend/scripts/init-admin.js` 文件来自定义管理员账户：
```javascript
const adminUser = {
    username: 'admin',  // 修改管理员用户名
    password: 'admin123',  // 修改管理员密码
    role: 'admin'  // 不要修改此项
};
```

注意：请在首次使用时立即修改默认密码，以确保系统安全。

## 使用指南

### 录制任务

1. 在"新建录制任务"中输入视频流地址
2. 配置必要参数（保存目录、线程数等）
3. 点击"开始录制"

### 任务管理

- 查看任务状态和进度
- 打开控制台查看详细信息
- 停止/删除任务
- 下载已完成的录制文件

## 目录结构

```
.
├── backend/           # 后端代码
│   ├── downloads/    # 下载文件目录
│   ├── temp/        # 临时文件目录
│   └── server.js    # 后端主程序
├── frontend/        # 前端代码
└── Sever.exe       # N_m3u8DL-RE 程序
```

## 更新日志

# 更新日志

### 2025-04-20

- **多源IPTV支持**
  - 添加了多个IPTV源管理功能，支持添加、编辑、删除和启用/禁用操作
  - 自动合并来自不同源的频道并去除重复项
  - 在IPTV直播页面添加了源过滤功能，可按源筛选频道
  - 在频道列表中显示源信息，方便识别频道来源

- **数据库初始化优化**
  - 整合所有数据库升级脚本，自动执行初始化，提高系统稳定性

- **用户管理功能增强**
  - 添加用户启用/禁用和注册审核功能，提升权限管理能力

- **文件管理功能升级**
  - 添加文件和临时文件管理功能，支持批量删除和一键清理

- **日志与错误处理优化**
  - 优化日志输出策略，减少干扰并突出重要信息
  - 完善错误处理机制，提供更清晰的提示

- **前端请求机制改进**
  - 重构登录和注册组件，简化请求方式并添加备用机制

- **CORS跨域处理优化**
  - 重构CORS中间件，简化配置并增强兼容性

- **批量任务功能完善**
  - 添加批量任务组一键删除功能，优化删除流程并防止误操作

- **批量录制功能优化**
  - 修复批量录制任务控制台显示问题，确保实时更新和数据同步
  - 优化IPTV批量录制地址丢失和频道搜索功能

- **性能与稳定性提升**
  - 修复内存泄漏和性能问题，优化WebSocket连接管理和终端输出处理

### 2025-04-17
**终端交互功能增强**：（实验性，未经测试）
- 添加了自动识别选择菜单功能，当检测到"请选择"类提示时自动显示更友好的UI界面
- 支持通过键盘快捷键直接选择菜单项，无需手动输入
- 支持点击按钮选择菜单项，提高用户体验
- 优化了终端输出显示，增强了交互体验
- 重构了终端输入处理逻辑，提高了稳定性

### 2025-04-16
**仪表盘和任务管理自动刷新功能**：
- 添加了仪表盘自动刷新功能，每10秒自动更新统计数据和最新任务列表
- 添加了任务管理页面的自动刷新功能，实时显示任务状态变化
- 修复了仪表盘统计数据不准确的问题，正确显示活跃下载和已完成任务数量
- 优化了用户界面，增加了自动刷新提示，提升用户体验
- 完善了导航功能，添加了Logo和返回首页的快捷链接

**仪表盘数据库架构重构**：
- 将用户数据库与任务数据库分离，使用独立的 users.db 和 tasks.db
- 重构了用户路由和仪表盘路由，使其正确连接到各自的数据库
- 优化了数据库查询逻辑，提高了系统性能和稳定性
- 添加了详细的日志输出，便于调试和问题跟踪

### 2025-04-15
**仪表盘功能全面完善**：
- 完成了用户管理功能，支持用户的增删改查操作
- 完成了任务管理功能，支持任务的停止、删除、查看详情和下载文件
- 完成了系统设置功能，支持IPTV源配置、存储设置和系统参数设置
- 添加了管理员权限验证机制，确保只有管理员可以访问仪表盘
- 优化了用户界面，提供了更好的交互体验

### 2025-04-14
**仪表盘功能完善**：
- 完成了管理员仪表盘的基础功能开发
- 添加了统计数据展示，包括用户数、活跃任务数、已完成任务数和存储使用情况
- 实现了最近任务列表展示
- 添加了用户管理、任务管理和系统设置的占位页面
- 完善了管理员路由权限验证

### 2025-04-04
1.**认证系统重构**：
   - 将原来基于MongoDB/Mongoose的认证系统改为使用SQLite数据库
   - 修改了auth.js路由，使其使用userDb.js中的函数而不是Mongoose模型
   - 在server.js中正确导入和使用auth.js路由模块
   - 简化了用户注册和登录流程，移除了email字段和一些不必要的状态检查

2.**前端配置优化**：
   - 添加了VITE_ALLOWED_HOSTS环境变量，支持动态配置允许访问的域名
   - 在vite.config.js中使用该环境变量配置allowedHosts
   - 更新了README.md，添加了关于新环境变量的说明和使用方法

3.**其他小改动**：
   - 修复了一些格式问题（空格、换行等）

## 已知问题

 - 源程序有支持相关交互选择功能，网页版已实现终端交互选择功能，支持通过键盘快捷键或点击按钮进行选择。
 - 大部分可选命令我暂时用不上，没有条件测试，可能存在BUG。
 - 该项目只是提供了一个相对便捷的网页版ui供大家方便使用，如涉及到源程序N_m3u8DL-RE（https://github.com/nilaoda/N_m3u8DL-RE） 的问题，请到源项目提出相关issue。
 - 后台仪表盘功能已全面完善：
   * 统计面板：显示用户数量、活跃任务数、已完成任务数和存储使用情况
   * 用户管理：查看所有用户、添加/删除用户、修改用户权限、启用/禁用用户
   * 待审核用户管理：快速审核新注册用户，批准或拒绝用户注册申请
   * 任务管理：查看所有任务、停止运行中任务、删除任务、下载已完成文件
   * 文件管理：查看和管理下载文件和临时文件、批量删除文件、一键清理临时文件
   * 系统设置：配置IPTV源、设置存储路径、管理系统参数
   * 自动刷新：每10秒自动更新统计数据和任务状态
   * 权限控制：只有管理员可访问仪表盘功能
 - 在使用过程中如遇到性能问题，可尝试清除浏览器缓存或重启服务。最新版本已优化WebSocket连接和内存管理，显著提高了稳定性。
 - 本项目作者并不会编程，是通过windsurf+claude并用自然语言交流完成的本项目开发，如在部署过程中有问题或使用过程中存在问题，请自行分析日志解决，日志部分可在/logs目录下查看（仅显示录制过程日志），开发这个项目的初衷也是为了满足作者自身需求。

## 许可证

MIT

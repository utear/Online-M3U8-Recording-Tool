# 视频流录制工具

基于 [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) 的网页版视频流录制工具，提供友好的用户界面来管理视频流（M3U/M3U8等）的录制任务。

在此对项目原作者nilaoda大佬表示衷心的感谢。

## 系统要求

- Node.js 16+
- N_m3u8DL-RE 可执行文件

## 主要功能

- 支持录制 m3u/m3u8/视频流
- 多任务并行录制，实时显示进度
- 可配置下载参数（线程数、保存目录等）
- 内置进程控制终端，支持实时交互（可能存在bug）
- 完整的文件管理机制
- IPTV直播列表自动更新机制：
  - 服务器端每4小时自动更新一次IPTV列表
  - 本地缓存支持，减少网络请求
  - 支持HTTP代理配置，解决GitHub访问问题
  - 默认IPTV源：https://github.com/vbskycn/iptv/blob/master/tv/iptv4.m3u
- 用户权限管理系统：
  - 支持用户注册和登录
  - 基于JWT的安全认证机制
  - 管理员账户功能：
    * 查看所有用户的任务记录
    * 任务管理（开发中）
    * 用户权限管理（开发中）
  - 普通用户功能：
    * 创建和管理自己的录制任务
    * 实时查看任务进度
    * 下载已完成的录制文件
- 文件下载功能：
  - 支持大文件下载
  - 实时显示下载进度
  - 基于用户权限的访问控制
  - 自动文件完整性检查

## 图片演示
![image](https://github.com/user-attachments/assets/e131c55d-2611-4061-bdd3-bae8d147941c)
![image](https://github.com/user-attachments/assets/a629356c-7a28-43c4-a00e-37e466eed950)
![image](https://github.com/user-attachments/assets/377f3941-fd94-4f3a-ab57-c609ccf03958)
![image](https://github.com/user-attachments/assets/1508b9f2-96c4-4095-9a1b-70b26dc76dac)
![image](https://github.com/user-attachments/assets/2b3d35df-bb2e-4305-a617-561c58b76c92)
![image](https://github.com/user-attachments/assets/d2ae4876-8b9e-4374-8cc9-52290e65b432)
![image](https://github.com/user-attachments/assets/ee183707-6057-408b-ab8f-671fe79b3908)
![image](https://github.com/user-attachments/assets/ab5c9fe9-9317-41c8-bf02-1036cd36540f)

## 快速开始

### 安装

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
```

2. 前端配置 (`frontend/.env`):
```bash
# 前端访问地址和端口配置
VITE_HOST=0.0.0.0  # 允许外部访问
VITE_PORT=3005     # 前端服务端口

# API 接口配置（根据实际部署环境修改）
VITE_API_BASE_URL=http://your-server-ip:3001  # 替换为实际的服务器地址
VITE_WS_URL=ws://your-server-ip:3002          # 替换为实际的服务器地址
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

### 2025-01-17
#### 新增功能
1. **用户权限管理**:
   - 完善管理员账户功能，支持查看所有用户的任务记录
   - 优化用户角色管理，从数据库读取角色信息
   - 修复管理员权限验证问题

2. **文件下载功能**:
   - 改进文件下载授权机制，确保用户只能下载自己的任务文件
   - 优化文件下载流程，支持大文件下载
   - 添加文件名和大小检查
   - 新增下载进度实时显示：
     * 点击下载时显示"准备下载"提示
     * 屏幕中央显示实时下载进度百分比
     * 下载完成后自动提示
     * 使用流式读取优化大文件下载性能

3. **系统优化**:
   - 精简后台日志输出，减少不必要的信息
   - 改进错误处理和用户提示
   - 优化数据库查询性能

#### 修复问题
- 修复管理员账户无法查看所有任务的问题
- 修复文件下载权限验证问题
- 优化后台日志输出，避免信息刷屏
- 修复下载按钮点击后没有即时反馈的问题

## 已知问题

 - 源程序有支持相关交互选择功能，虽然这个网页版引入了terminal，但由于我个人暂时用不到交互选项，所以没有条件测试，可能存在BUG。
 - 大部分可选命令我暂时用不上，没有条件测试，可能存在BUG。
 - 该项目只是提供了一个相对便捷的网页版ui供大家方便使用，如涉及到源程序N_m3u8DL-RE（https://github.com/nilaoda/N_m3u8DL-RE） 的问题，请到源项目提出相关issue。
 - 后台仪表盘未完成开发，只是一个框架模板，请无视。
 - 本项目作者并不会编程，是通过windsurf+claude并用自然语言交流完成的本项目开发，如在部署过程中有问题或使用过程中存在问题，请自行分析日志解决，日志部分可在/logs目录下查看（仅显示录制过程日志），开发这个项目的初衷也是为了满足作者自身需求。

## 许可证

MIT

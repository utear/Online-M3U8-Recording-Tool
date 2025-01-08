# 视频流录制工具

基于 [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) 的网页版视频流录制工具，提供友好的用户界面来管理视频流的录制任务。

## 系统要求

- Node.js 16+
- N_m3u8DL-RE 可执行文件

## 主要功能

- 支持录制 m3u/m3u8/视频流
- 多任务并行录制，实时显示进度
- 可配置下载参数（线程数、保存目录等）
- 内置进程控制终端，支持实时交互
- 完整的文件管理机制

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

# API 接口配置
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
```

注意：开发环境可使用 localhost，生产环境请替换为实际的服务器地址。

### 启动

1. 启动后端：
```bash
cd backend
node server.js
```

2. 启动前端：
```bash
cd frontend
npm run dev
```

3. 访问：`http://localhost:5173`

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

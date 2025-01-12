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
- iptv直播地址默认采用：https://github.com/vbskycn/iptv/blob/master/tv/iptv4.m3u  #（在此感谢作者），如需修改请前往/fontend/src/page/IPTVPage.tsx的38行地址，注意格式要是标准的M3U格式内容

## 已知问题

 - 源程序有支持相关交互选择功能，虽然这个网页版引入了terminal，但由于我个人暂时用不到交互选项，所以没有条件测试，可能存在BUG。
 - 大部分可选命令我暂时用不上，没有条件测试，可能存在BUG。
 - 该项目只是提供了一个相对便捷的网页版ui供大家方便使用，如涉及到源程序N_m3u8DL-RE（https://github.com/nilaoda/N_m3u8DL-RE） 的问题，请到源项目提出相关issue。
 - 后台仪表盘未完成开发，只是一个框架模板，请无视。
 - 本项目作者并不会编程，是通过windsurf+claude并用自然语言交流完成的本项目开发，如在部署过程中有问题或使用过程中存在问题，请自行分析日志解决，日志部分可在/logs目录下查看（仅显示录制过程日志），开发这个项目的初衷也是为了满足作者自身需求。

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
```
## 最新更新

### IPTV直播页面优化
- 使用虚拟列表（Virtual List）技术，显著提升大量频道时的加载性能
- 添加分页加载功能，每次加载50个频道
- 新增频道分组功能，可按分组快速筛选
- 优化搜索性能，使用useMemo缓存过滤结果
- 添加加载状态指示和频道总数显示
- 改进了UI布局和交互体验

### 2025-01-12

#### 界面布局优化
- 重新设计了顶部导航栏布局：
  - 将标题和导航菜单整合到一行，提供更紧凑的界面
  - 优化了导航菜单样式，使用透明背景融入顶部栏
  - 改进了菜单项的视觉效果，包括悬停和选中状态
  - 调整了间距和对齐，确保所有元素垂直居中

#### IPTV直播功能优化
- 简化了IPTV直播页面的界面：
  - 移除了频道图片显示，专注于频道信息
  - 优化了频道列表的展示方式
  - 添加了快速搜索功能
  - 实现了一键填充播放地址功能
- 改进了播放地址的填充机制：
  - 使用Form实例直接更新表单值
  - 添加了操作成功的反馈提示
  - 优化了错误处理机制

#### 样式优化
- 统一使用红色主题（#f5222d）
- 优化了导航菜单的交互效果：
  - 添加了半透明的悬停效果
  - 改进了选中状态的视觉反馈
  - 优化了文字的可读性
- 调整了内容区域的样式：
  - 增加了适当的边距和圆角
  - 优化了卡片和列表的显示效果
  - 改进了整体的视觉层次

## 许可证

MIT

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

## 已知问题

 - 源程序有支持相关交互选择功能，虽然这个网页版引入了terminal，但由于我个人暂时用不到交互选项，所以没有条件测试，可能存在BUG。
 - 大部分可选命令我暂时用不上，没有条件测试，可能存在BUG。
 - 该项目只是提供了一个相对便捷的网页版ui供大家方便使用，如涉及到源程序N_m3u8DL-RE（https://github.com/nilaoda/N_m3u8DL-RE）的问题，请到源项目提出相关issue。
 - 后台仪表盘未完成开发，只是一个框架模板，请无视。
 - 本项目作者并不会编程，是通过windsurf+claude并用自然语言交流完成的本项目开发，如在部署过程中有问题或使用过程中存在问题，请自行分析日志解决，日志部分可在/logs目录下查看（仅显示录制过程日志），开发这个项目的初衷也是为了满足作者自身需求。

## 图片演示
![a35a513a296a84d2ff8b32af0d1ab65](https://github.com/user-attachments/assets/4c798bec-fea5-46cb-9751-aac99c31604d)
![e74c1adc9c41002f33d9456c005ab0e](https://github.com/user-attachments/assets/55a39c60-bbcb-49c5-884c-f56ffda7b019)
![4068d4e163d5d58c081f7afb8342b75](https://github.com/user-attachments/assets/c62b01f1-2509-4116-bff8-29356a5831dd)
![865646a05da808fe00656b86519b69a](https://github.com/user-attachments/assets/98cadd08-39d2-4d20-98a4-7abdb16b2818)
![8aac3bead51d3ccc4d3fb4058146583](https://github.com/user-attachments/assets/f0786543-bc7d-498f-8b4f-d8d66e3503e6)
![070b83483d458e0d5457dcbb0d4e7c0](https://github.com/user-attachments/assets/9cf79bd4-87c6-45f2-8995-40776e5253dd)
![3ce2af9b5093b88ed49f58ab62deb50](https://github.com/user-attachments/assets/e6b1586f-2646-49f6-b437-3f5d605eecba)

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
## 更新日志

### 2025-01-11

#### 任务列表优化
- 修复了任务列表中开始时间不显示的问题
- 优化了时间显示格式，现在使用标准的 YYYY-MM-DD HH:mm:ss 格式
- 改进了任务创建时间的处理逻辑，确保准确显示任务开始时间
- 优化了任务状态显示：
  - 简化状态显示逻辑，现在只显示"录制中"、"已完成"、"已暂停"和"录制失败"四种状态
  - 提高了状态显示的清晰度和一致性

### 2025-01-10

#### 文件处理优化
- 改进了录制文件保存状态的判断逻辑，现在支持检查相同文件名的不同格式文件
- 优化了下载功能，能够正确识别并下载不同格式的录制文件
- 增强了文件路径处理的兼容性，支持多种文件格式的保存和下载

### 2025-01-09

#### Bug修复
- 修复了定时开关（DatePicker）组件的日期验证问题
- 优化了日期时间选择的处理逻辑，确保数据格式的一致性
- 改进了表单验证机制，提供更好的用户体验

#### 界面优化
- 优化了任务列表的列宽显示，实现自适应布局
- 调整了视频流地址列宽度，为其他重要信息预留更多空间
- 修复了操作按钮超出边界的问题
- 改进了停止按钮的显示逻辑和反馈信息
- 优化了各列的最大宽度限制，防止内容溢出

### 2025-01-08

#### 下载功能改进
- 优化了文件下载机制，使用绝对路径处理文件
- 增加了详细的日志记录，便于问题排查
- 增强了错误处理机制，提供更清晰的错误提示
- 修复了生产环境中可能出现的 502 错误问题

#### 部署注意事项
1. 确保下载目录具有正确的读写权限
2. 检查并记录服务器日志以便排查问题
3. 监控服务器内存使用情况
4. 验证文件路径解析是否正确

## 许可证

MIT

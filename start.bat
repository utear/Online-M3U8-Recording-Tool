@echo off
echo 正在启动视频流录制工具...

:: 创建下载目录
if not exist downloads mkdir downloads

:: 启动后端服务器
start cmd /k "cd backend && node server.js"

:: 等待2秒确保后端启动
timeout /t 2 /nobreak

:: 启动前端开发服务器
start cmd /k "cd frontend && npm run dev"

:: 等待5秒
timeout /t 5 /nobreak

:: 打开浏览器
start http://localhost:5173

echo 服务已启动！
echo 后端运行在: http://localhost:3001
echo 前端运行在: http://localhost:5173 
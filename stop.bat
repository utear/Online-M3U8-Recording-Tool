@echo off
echo 正在停止视频流录制工具...

:: 查找并终止Node.js进程
taskkill /F /IM node.exe

:: 查找并终止录制进程
taskkill /F /IM Sever.exe

echo 所有服务已停止！ 
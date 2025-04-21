const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const iconv = require('iconv-lite');
const { db } = require('../models/database');
const {
    addTaskGroup,
    addTaskWithGroup,
    updateTaskGroupStatus,
    updateTaskGroupCount,
    getTasksByGroupId,
    getAllTaskGroups,
    getTaskGroupById,
    updateTaskStatus,
    addTaskHistory,
    updateTaskOutput,
    updateTaskTempDir,
    deleteTaskGroup
} = require('../models/database');

// 批量创建录制任务
router.post('/start', async (req, res) => {
    try {
        const { urls, groupName, options } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ message: '请提供有效的URL列表' });
        }

        // 创建任务组
        const groupId = Date.now().toString();
        const taskGroup = {
            id: groupId,
            name: groupName || `批量任务-${new Date().toLocaleString()}`,
            username: req.user.username,
            status: 'running',
            createdAt: new Date().toISOString(),
            taskCount: urls.length
        };

        await addTaskGroup(taskGroup);

        // 创建每个任务
        const taskIds = [];
        for (const url of urls) {
            if (!url.trim()) continue; // 跳过空URL

            const taskId = `${groupId}-${taskIds.length + 1}`;
            const task = {
                id: taskId,
                username: req.user.username,
                url: url.trim(),
                status: 'pending', // 初始状态为等待
                createdAt: new Date().toISOString(),
                groupId: groupId,
                options: JSON.stringify(options)
            };

            await addTaskWithGroup(task);
            taskIds.push(taskId);
        }

        // 开始启动任务（这里可以实现队列机制，但简单起见，我们直接启动所有任务）
        for (const taskId of taskIds) {
            startRecordingTask(taskId, req.user.username, options);
        }

        res.json({
            groupId,
            taskCount: taskIds.length,
            message: `成功创建${taskIds.length}个录制任务`
        });
    } catch (error) {
        console.error('批量创建任务失败:', error);
        res.status(500).json({ message: '批量创建任务失败' });
    }
});

// 停止任务组中的所有任务
router.post('/:groupId/stop', async (req, res) => {
    try {
        const { groupId } = req.params;

        // 获取任务组中的所有任务
        const tasks = await getTasksByGroupId(groupId);

        if (!tasks || tasks.length === 0) {
            return res.status(404).json({ message: '任务组不存在或没有任务' });
        }

        // 检查权限（只有任务创建者或管理员可以停止任务）
        if (req.user.role !== 'admin' && tasks[0].username !== req.user.username) {
            return res.status(403).json({ message: '没有权限停止此任务组' });
        }

        // 停止所有任务
        for (const task of tasks) {
            const activeTask = global.activeTasks.get(task.id);
            if (activeTask && activeTask.process) {
                // Windows下使用taskkill强制结束进程树
                spawn('taskkill', ['/pid', activeTask.process.pid, '/f', '/t']);

                await updateTaskStatus(task.id, 'stopped');
                activeTask.status = 'stopped';
                activeTask.process = null;
            }
        }

        // 更新任务组状态
        await updateTaskGroupStatus(groupId, 'stopped');

        res.json({ message: '已停止任务组中的所有任务' });
    } catch (error) {
        console.error('停止任务组失败:', error);
        res.status(500).json({ message: '停止任务组失败' });
    }
});

// 获取任务组列表
router.get('/', async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const taskGroups = await getAllTaskGroups(req.user.username, isAdmin);
        res.json(taskGroups);
    } catch (error) {
        console.error('获取任务组列表失败:', error);
        res.status(500).json({ message: '获取任务组列表失败' });
    }
});

// 获取任务组详情
router.get('/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;

        // 获取任务组信息
        const group = await getTaskGroupById(groupId);

        if (!group) {
            return res.status(404).json({ message: '任务组不存在' });
        }

        // 检查权限
        if (req.user.role !== 'admin' && group.username !== req.user.username) {
            return res.status(403).json({ message: '没有权限查看此任务组' });
        }

        // 获取任务组中的所有任务
        const tasks = await getTasksByGroupId(groupId);

        res.json({
            group,
            tasks
        });
    } catch (error) {
        console.error('获取任务组详情失败:', error);
        res.status(500).json({ message: '获取任务组详情失败' });
    }
});

// 删除任务组和其关联的所有任务
router.delete('/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;

        // 获取任务组信息
        const group = await getTaskGroupById(groupId);

        if (!group) {
            return res.status(404).json({ message: '任务组不存在' });
        }

        // 检查权限（只有任务创建者或管理员可以删除任务组）
        if (req.user.role !== 'admin' && group.username !== req.user.username) {
            return res.status(403).json({ message: '没有权限删除此任务组' });
        }

        // 获取任务组中的所有任务
        const tasks = await getTasksByGroupId(groupId);

        // 停止并删除任务组中所有仍在运行的任务
        for (const task of tasks) {
            // 如果任务正在运行，先停止进程
            const activeTask = global.activeTasks.get(task.id);
            if (activeTask && activeTask.process) {
                try {
                    // Windows下使用taskkill强制结束进程树
                    spawn('taskkill', ['/pid', activeTask.process.pid, '/f', '/t']);
                    activeTask.status = 'stopped';
                    activeTask.process = null;
                } catch (error) {
                    console.error(`停止任务 ${task.id} 失败:`, error);
                }
            }

            // 从活动任务中移除
            if (global.activeTasks.has(task.id)) {
                global.activeTasks.delete(task.id);
            }

            // 删除任务的输出文件和临时目录
            try {
                // 获取任务详细信息
                const taskInfo = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM tasks WHERE id = ?', [task.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                // 1. 删除输出文件
                if (taskInfo && taskInfo.outputFile) {
                    try {
                        // 获取文件名和目录
                        const outputDir = path.dirname(taskInfo.outputFile);
                        const baseNameWithoutExt = path.basename(taskInfo.outputFile, path.extname(taskInfo.outputFile));

                        // 列出目录中的所有文件
                        if (fs.existsSync(outputDir)) {
                            const files = fs.readdirSync(outputDir);
                            // 查找匹配的文件
                            const matchingFiles = files.filter(file => file.startsWith(baseNameWithoutExt));

                            if (matchingFiles.length > 0) {
                                console.log(`找到匹配的输出文件: ${matchingFiles.join(', ')}`);

                                // 删除所有匹配的文件
                                for (const file of matchingFiles) {
                                    const filePath = path.join(outputDir, file);
                                    fs.unlinkSync(filePath);
                                    console.log(`成功删除输出文件: ${filePath}`);
                                }
                            } else {
                                console.log(`未找到匹配的输出文件: ${baseNameWithoutExt}`);
                            }
                        }
                    } catch (fileError) {
                        console.error(`删除输出文件失败:`, fileError);
                    }
                }

                // 2. 删除与任务相关的所有临时目录
                try {
                    const tempDir = path.join(__dirname, '..', 'temp');
                    if (fs.existsSync(tempDir)) {
                        const entries = fs.readdirSync(tempDir);
                        let deletedDirs = [];

                        // 2.1 先尝试删除数据库中记录的临时目录
                        if (taskInfo && taskInfo.tempDir && fs.existsSync(taskInfo.tempDir)) {
                            console.log(`开始删除数据库记录的临时目录: ${taskInfo.tempDir}`);
                            fs.rmSync(taskInfo.tempDir, { recursive: true, force: true });
                            console.log(`成功删除数据库记录的临时目录: ${taskInfo.tempDir}`);
                            deletedDirs.push(path.basename(taskInfo.tempDir));
                        }

                        // 2.2 如果有输出文件，尝试删除与输出文件名匹配的临时目录
                        if (taskInfo && taskInfo.outputFile) {
                            const baseNameWithoutExt = path.basename(taskInfo.outputFile, path.extname(taskInfo.outputFile));
                            const m3u8TempPath = path.join(tempDir, baseNameWithoutExt);

                            if (fs.existsSync(m3u8TempPath) && !deletedDirs.includes(baseNameWithoutExt)) {
                                console.log(`开始删除与输出文件匹配的临时目录: ${m3u8TempPath}`);
                                fs.rmSync(m3u8TempPath, { recursive: true, force: true });
                                console.log(`成功删除与输出文件匹配的临时目录: ${m3u8TempPath}`);
                                deletedDirs.push(baseNameWithoutExt);
                            }
                        }

                        // 2.3 尝试使用任务ID匹配系统临时目录
                        const taskIdPattern = task ? task.id : null;
                        if (taskIdPattern) {
                            const matchingDirs = entries.filter(entry =>
                                (entry.includes(taskIdPattern) || // 完整任务ID
                                entry.startsWith(taskIdPattern.split('-')[0])) && // 任务ID的基础部分
                                !deletedDirs.includes(entry) // 避免重复删除
                            );

                            for (const dir of matchingDirs) {
                                const dirPath = path.join(tempDir, dir);
                                if (fs.statSync(dirPath).isDirectory()) {
                                    console.log(`开始删除与任务ID匹配的临时目录: ${dirPath}`);
                                    fs.rmSync(dirPath, { recursive: true, force: true });
                                    console.log(`成功删除与任务ID匹配的临时目录: ${dirPath}`);
                                    deletedDirs.push(dir);
                                }
                            }
                        }

                        // 2.4 尝试匹配文件名格式的临时目录（如 1002_1_2025-04-21_10-40-31）
                        const fileNamePattern = /^\d+_\d+_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;
                        const datePattern = new RegExp(`\d{4}-\d{2}-\d{2}_\d{2}-\d{2}`);

                        // 获取当前日期字符串，用于匹配当天创建的临时目录
                        const today = new Date();
                        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                        for (const entry of entries) {
                            // 如果已经删除过这个目录，跳过
                            if (deletedDirs.includes(entry)) continue;

                            // 检查是否是目录
                            const entryPath = path.join(tempDir, entry);
                            if (!fs.statSync(entryPath).isDirectory()) continue;

                            // 检查是否符合文件名格式或包含当天日期
                            if (fileNamePattern.test(entry) ||
                                (datePattern.test(entry) && entry.includes(dateStr))) {
                                console.log(`开始删除符合格式的临时目录: ${entryPath}`);
                                fs.rmSync(entryPath, { recursive: true, force: true });
                                console.log(`成功删除符合格式的临时目录: ${entryPath}`);
                                deletedDirs.push(entry);
                            }
                        }
                    }
                } catch (dirError) {
                    console.error(`删除临时目录失败:`, dirError);
                }
            } catch (error) {
                console.error(`删除批量任务文件失败:`, error);
            }

            // 从数据库中删除任务
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM tasks WHERE id = ?', [task.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 删除任务历史记录
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM task_history WHERE taskId = ?', [task.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        // 删除任务组
        await deleteTaskGroup(groupId);

        res.json({ message: '任务组及其所有任务已删除' });
    } catch (error) {
        console.error('删除任务组失败:', error);
        res.status(500).json({ message: '删除任务组失败' });
    }
});

// 启动录制任务的辅助函数
async function startRecordingTask(taskId, username, options) {
    try {
        // 获取任务信息
        const task = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!task) {
            console.error(`任务 ${taskId} 不存在`);
            return;
        }

        // 解析选项
        const taskOptions = JSON.parse(task.options || '{}');

        // 构建命令行参数
        const url = task.url;
        const args = [url];

        // 处理保存目录路径
        let saveDir = taskOptions['save-dir'] || './downloads';
        let tmpDir = taskOptions['tmp-dir'] || './temp';

        // 如果是相对路径，转换为绝对路径
        if (!path.isAbsolute(saveDir)) {
            saveDir = path.resolve(__dirname, '..', saveDir);
        }
        if (!path.isAbsolute(tmpDir)) {
            tmpDir = path.resolve(__dirname, '..', tmpDir);
        }

        // 确保目录存在
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // 添加命令行参数
        args.push('--save-dir', saveDir);
        args.push('--tmp-dir', tmpDir);

        // 处理其他选项
        for (const [key, value] of Object.entries(taskOptions)) {
            if (key !== 'save-dir' && key !== 'tmp-dir' && value) {
                if (typeof value === 'boolean') {
                    if (value) args.push(`--${key}`);
                } else {
                    args.push(`--${key}`, value.toString());
                }
            }
        }

        console.log(`启动批量任务 ${taskId} 命令:`, args.join(' '));

        // 启动录制进程
        const childProcess = spawn(path.join(__dirname, '..', '..', 'Sever.exe'), args, {
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                LANG: 'zh_CN.UTF-8'
            },
            stdio: ['pipe', 'pipe', 'pipe'] // 启用标准输入输出
        });

        // 更新任务状态
        await updateTaskStatus(taskId, 'running');

        // 生成并保存临时目录路径
        // 使用任务ID作为临时目录名称，确保唯一性
        const tempDirName = taskId;
        const tempDirPath = path.join(tmpDir, tempDirName);

        // 在命令行参数中添加临时目录参数
        // 先移除原来的--tmp-dir参数
        const tmpDirIndex = args.indexOf('--tmp-dir');
        if (tmpDirIndex !== -1 && tmpDirIndex + 1 < args.length) {
            args.splice(tmpDirIndex, 2);
        }
        // 添加新的临时目录参数
        args.push('--tmp-dir', tempDirPath);

        // 确保临时目录存在
        if (!fs.existsSync(tempDirPath)) {
            fs.mkdirSync(tempDirPath, { recursive: true });
        }

        await updateTaskTempDir(taskId, tempDirPath);
        console.log(`批量任务 ${taskId} 保存临时目录路径:`, tempDirPath);

        // 将任务添加到活动任务列表
        global.activeTasks.set(taskId, {
            id: taskId,
            username: username,
            url: url,
            status: 'running',
            createdAt: new Date().toISOString(),
            options: taskOptions,
            process: childProcess,
            outputFile: path.join(saveDir, taskOptions['save-name'] || 'output.ts'),
            saveDir: saveDir,
            outputHistory: ''
        });

        // 处理进程输出
        childProcess.stdout.on('data', async (data) => {
            const output = iconv.decode(data, 'gb2312')
                .replace(/\r\n/g, '\n')  // 统一换行符
                .replace(/\r/g, '\n')
                .trim();

            if (!output) return;  // 忽略空输出

            console.log(`批量任务 ${taskId} 输出:`, output);

            // 更新活动任务的输出历史记录
            const task = global.activeTasks.get(taskId);
            if (task) {
                task.outputHistory += output + '\n';  // 确保每条输出后面都有换行

                // 检查输出中是否包含文件大小信息
                const fileSizeMatch = output.match(/(\d+(\.\d+)?)\s*MB/);
                if (fileSizeMatch) {
                    const fileSizeMB = parseFloat(fileSizeMatch[1]);
                    task.fileSize = fileSizeMB * 1024 * 1024; // 转换为字节
                }

                // 检查输出中是否包含保存文件名信息
                const saveNameMatch = output.match(/保存文件名:\s*(.+)/);
                if (saveNameMatch) {
                    const actualFileName = saveNameMatch[1].trim();
                    task.outputFile = path.join(task.saveDir, `${actualFileName}.ts`);
                    console.log(`批量任务 ${taskId} 更新实际输出文件路径:`, task.outputFile);
                }
            }

            // 将消息添加到缓冲区
            if (global.messageBuffer) {
                if (!global.messageBuffer.has(taskId)) {
                    global.messageBuffer.set(taskId, []);
                }
                global.messageBuffer.get(taskId).push({
                    type: 'progress',
                    taskId,
                    output: output + '\n',  // 确保每条输出后面都有换行
                    fileSize: task ? task.fileSize : 0
                });
            }

            // 更新数据库
            await updateTaskStatus(taskId, 'running', output);
            await addTaskHistory(taskId, output);
        });

        // 处理进程错误
        childProcess.stderr.on('data', async (data) => {
            const error = iconv.decode(data, 'gb2312').trim();
            console.error(`批量任务 ${taskId} 错误:`, error);

            // 更新活动任务的输出历史记录
            const task = global.activeTasks.get(taskId);
            if (task) {
                task.outputHistory += `错误: ${error}\n`;
            }

            // 将消息添加到缓冲区
            if (global.messageBuffer) {
                if (!global.messageBuffer.has(taskId)) {
                    global.messageBuffer.set(taskId, []);
                }
                global.messageBuffer.get(taskId).push({
                    type: 'progress',
                    taskId,
                    output: `错误: ${error}\n`
                });
            }

            // 更新数据库
            await updateTaskStatus(taskId, 'running', `错误: ${error}`);
            await addTaskHistory(taskId, `错误: ${error}`);
        });

        // 处理进程结束
        childProcess.on('close', async (code) => {
            console.log(`批量任务 ${taskId} 结束，退出码:`, code);

            // 获取任务信息
            const task = global.activeTasks.get(taskId);
            if (task) {
                console.log(`批量任务 ${taskId} 输出文件路径:`, task.outputFile);
                console.log(`批量任务 ${taskId} 保存目录:`, task.saveDir);

                // 检查文件是否存在
                const checkFileExists = (filePath) => {
                    // 获取文件名（不含扩展名）和目录
                    const dir = path.dirname(filePath);
                    const baseNameWithoutExt = path.basename(filePath, path.extname(filePath));

                    // 读取目录下所有文件
                    const files = fs.readdirSync(dir);

                    // 检查是否存在相同文件名（不考虑扩展名）的文件
                    return files.some(file => {
                        const currentBaseNameWithoutExt = path.basename(file, path.extname(file));
                        return currentBaseNameWithoutExt === baseNameWithoutExt;
                    });
                };

                const fileExists = checkFileExists(task.outputFile);
                console.log(`批量任务 ${taskId} 文件是否存在:`, fileExists);

                // 列出保存目录中的文件
                console.log(`批量任务 ${taskId} 保存目录内容:`, fs.readdirSync(task.saveDir));

                // 确定最终状态
                let status = 'failed';
                if (fileExists) {
                    status = task.status === 'stopped' ? 'paused' : 'completed';
                }
                task.status = status;

                // 更新数据库
                await updateTaskStatus(taskId, status);
                if (fileExists) {
                    // 获取实际文件路径和大小
                    const dir = path.dirname(task.outputFile);
                    const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));
                    const files = fs.readdirSync(dir);
                    const actualFile = files.find(file => path.basename(file, path.extname(file)) === baseNameWithoutExt);
                    if (actualFile) {
                        const actualFilePath = path.join(dir, actualFile);
                        const fileSize = fs.statSync(actualFilePath).size;
                        task.fileSize = fileSize;
                        await updateTaskOutput(taskId, actualFilePath, fileSize);
                    }
                }

                // 将消息添加到缓冲区
                if (global.messageBuffer) {
                    if (!global.messageBuffer.has(taskId)) {
                        global.messageBuffer.set(taskId, []);
                    }
                    global.messageBuffer.get(taskId).push({
                        type: 'status',
                        taskId,
                        status,
                        fileSize: task.fileSize,
                        outputFile: task.outputFile
                    });
                }

                // 清空进程引用
                task.process = null;
            }
        });
    } catch (error) {
        console.error(`启动任务 ${taskId} 失败:`, error);
        await updateTaskStatus(taskId, 'failed');
    }
}

module.exports = router;
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db } = require('../models/database');
const { getAllTasks, getTaskHistory } = require('../models/database');

// 获取所有任务（管理员）
router.get('/all', async (req, res) => {
  try {
    // 管理员可以查看所有任务
    const tasks = await getAllTasks(req.user.username, true);
    res.json(tasks);
  } catch (error) {
    console.error('获取所有任务失败:', error);
    res.status(500).json({ message: '获取任务列表失败' });
  }
});

// 获取任务历史
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    // 验证任务是否存在
    const task = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!task) {
      return res.status(404).json({ message: '任务不存在' });
    }

    // 验证权限（管理员可以查看所有任务，普通用户只能查看自己的任务）
    if (req.user.role !== 'admin' && task.username !== req.user.username) {
      return res.status(403).json({ message: '没有权限查看此任务' });
    }

    const history = await getTaskHistory(id);
    res.json(history);
  } catch (error) {
    console.error('获取任务历史失败:', error);
    res.status(500).json({ message: '获取任务历史失败' });
  }
});

// 停止任务
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    // 验证任务是否存在
    const task = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!task) {
      return res.status(404).json({ message: '任务不存在' });
    }

    // 验证权限（管理员可以停止所有任务，普通用户只能停止自己的任务）
    if (req.user.role !== 'admin' && task.username !== req.user.username) {
      return res.status(403).json({ message: '没有权限停止此任务' });
    }

    // 更新任务状态
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE tasks SET status = ? WHERE id = ?',
        ['stopped', id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    // 如果任务进程还在运行，终止它
    const activeTasks = global.activeTasks || new Map();
    const activeTask = activeTasks.get(id);

    if (activeTask && activeTask.process) {
      try {
        activeTask.process.kill();
        console.log(`任务 ${id} 已被管理员停止`);
      } catch (killError) {
        console.error(`停止任务 ${id} 进程失败:`, killError);
      }
    }

    res.json({ message: '任务已停止' });
  } catch (error) {
    console.error('停止任务失败:', error);
    res.status(500).json({ message: '停止任务失败' });
  }
});

// 删除任务
router.delete('/:id', async (req, res) => {
  console.log(`[${new Date().toLocaleString()}] [tasks.js] 收到删除任务请求: ${req.params.id}`);
  console.log(`[${new Date().toLocaleString()}] [tasks.js] 请求用户: ${req.user.username}, 角色: ${req.user.role}`);
  console.log(`[${new Date().toLocaleString()}] [tasks.js] 请求头:`, req.headers);

  try {
    const { id } = req.params;
    console.log(`[${new Date().toLocaleString()}] [tasks.js] 开始删除任务: ${id}`);

    // 验证任务是否存在
    const task = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error(`[${new Date().toLocaleString()}] [tasks.js] 查询任务失败:`, err);
          reject(err);
        } else {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 查询任务结果:`, row ? '存在' : '不存在');
          resolve(row);
        }
      });
    });

    if (!task) {
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 任务不存在: ${id}`);
      return res.status(404).json({ message: '任务不存在' });
    }

    console.log(`[${new Date().toLocaleString()}] [tasks.js] 获取到任务信息:`, {
      id: task.id,
      username: task.username,
      status: task.status,
      outputFile: task.outputFile,
      tempDir: task.tempDir
    });

    // 验证权限（管理员可以删除所有任务，普通用户只能删除自己的任务）
    if (req.user.role !== 'admin' && task.username !== req.user.username) {
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 权限不足: ${req.user.username} 尝试删除 ${task.username} 的任务`);
      return res.status(403).json({ message: '没有权限删除此任务' });
    }

    // 如果任务进程还在运行，先停止它
    const activeTasks = global.activeTasks || new Map();
    const activeTask = activeTasks.get(id);

    if (activeTask && activeTask.process) {
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 停止运行中的进程: ${id}`);
      try {
        activeTask.process.kill();
        console.log(`[${new Date().toLocaleString()}] [tasks.js] 任务 ${id} 进程已终止`);
      } catch (killError) {
        console.error(`[${new Date().toLocaleString()}] [tasks.js] 终止任务 ${id} 进程失败:`, killError);
      }
    }

    // 1. 删除输出文件
    if (task.outputFile) {
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 尝试删除输出文件`);
      try {
        // 获取文件名和目录
        const outputDir = path.dirname(task.outputFile);
        const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));

        // 列出目录中的所有文件
        if (fs.existsSync(outputDir)) {
          const files = fs.readdirSync(outputDir);
          // 查找匹配的文件
          const matchingFiles = files.filter(file => file.startsWith(baseNameWithoutExt));

          if (matchingFiles.length > 0) {
            console.log(`[${new Date().toLocaleString()}] [tasks.js] 找到匹配的输出文件: ${matchingFiles.join(', ')}`);

            // 删除所有匹配的文件
            for (const file of matchingFiles) {
              const filePath = path.join(outputDir, file);
              fs.unlinkSync(filePath);
              console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除输出文件: ${filePath}`);
            }
          } else {
            console.log(`[${new Date().toLocaleString()}] [tasks.js] 未找到匹配的输出文件: ${baseNameWithoutExt}`);
          }
        }
      } catch (fileError) {
        console.error(`[${new Date().toLocaleString()}] [tasks.js] 删除输出文件失败:`, fileError);
      }
    }

    // 2. 删除与任务相关的所有临时目录
    try {
      const tempDir = path.join(__dirname, '..', 'temp');
      if (fs.existsSync(tempDir)) {
        const entries = fs.readdirSync(tempDir);
        let deletedDirs = [];

        // 2.1 先尝试删除数据库中记录的临时目录
        if (task.tempDir && fs.existsSync(task.tempDir)) {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 开始删除数据库记录的临时目录: ${task.tempDir}`);
          fs.rmSync(task.tempDir, { recursive: true, force: true });
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除数据库记录的临时目录: ${task.tempDir}`);
          deletedDirs.push(path.basename(task.tempDir));
        }

        // 2.2 如果有输出文件，尝试删除与输出文件名匹配的临时目录
        if (task.outputFile) {
          const baseNameWithoutExt = path.basename(task.outputFile, path.extname(task.outputFile));
          const m3u8TempPath = path.join(tempDir, baseNameWithoutExt);

          if (fs.existsSync(m3u8TempPath) && !deletedDirs.includes(baseNameWithoutExt)) {
            console.log(`[${new Date().toLocaleString()}] [tasks.js] 开始删除与输出文件匹配的临时目录: ${m3u8TempPath}`);
            fs.rmSync(m3u8TempPath, { recursive: true, force: true });
            console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除与输出文件匹配的临时目录: ${m3u8TempPath}`);
            deletedDirs.push(baseNameWithoutExt);
          }
        }

        // 2.3 尝试使用任务ID匹配系统临时目录
        const taskIdPattern = task.id;
        if (taskIdPattern) {
          const matchingDirs = entries.filter(entry =>
            (entry.includes(taskIdPattern) || // 完整任务ID
            entry.startsWith(taskIdPattern.split('-')[0])) && // 任务ID的基础部分
            !deletedDirs.includes(entry) // 避免重复删除
          );

          for (const dir of matchingDirs) {
            const dirPath = path.join(tempDir, dir);
            if (fs.statSync(dirPath).isDirectory()) {
              console.log(`[${new Date().toLocaleString()}] [tasks.js] 开始删除与任务ID匹配的临时目录: ${dirPath}`);
              fs.rmSync(dirPath, { recursive: true, force: true });
              console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除与任务ID匹配的临时目录: ${dirPath}`);
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
            console.log(`[${new Date().toLocaleString()}] [tasks.js] 开始删除符合格式的临时目录: ${entryPath}`);
            fs.rmSync(entryPath, { recursive: true, force: true });
            console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除符合格式的临时目录: ${entryPath}`);
            deletedDirs.push(entry);
          }
        }
      }
    } catch (dirError) {
      console.error(`[${new Date().toLocaleString()}] [tasks.js] 删除临时目录失败:`, dirError);

      // 如果删除失败，尝试使用命令行工具删除
      try {
        if (task.tempDir) {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 尝试使用命令行工具删除临时目录: ${task.tempDir}`);
          if (process.platform === 'win32') {
            // Windows下使用rd命令
            const { spawn } = require('child_process');
            const rdProcess = spawn('cmd', ['/c', 'rd', '/s', '/q', task.tempDir]);
            rdProcess.on('close', (code) => {
              console.log(`[${new Date().toLocaleString()}] [tasks.js] rd命令执行完成，退出码: ${code}`);
            });
          } else {
            // Linux/Mac下使用rm命令
            const { spawn } = require('child_process');
            const rmProcess = spawn('rm', ['-rf', task.tempDir]);
            rmProcess.on('close', (code) => {
              console.log(`[${new Date().toLocaleString()}] [tasks.js] rm命令执行完成，退出码: ${code}`);
            });
          }
        }
      } catch (cmdError) {
        console.error(`[${new Date().toLocaleString()}] [tasks.js] 命令行删除也失败:`, cmdError);
      }
    }

    // 删除任务记录
    console.log(`[${new Date().toLocaleString()}] [tasks.js] 开始删除数据库记录`);
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) {
          console.error(`[${new Date().toLocaleString()}] [tasks.js] 删除任务记录失败:`, err);
          reject(err);
        } else {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 任务记录已从数据库删除，影响行数: ${this.changes}`);
          resolve(this.changes);
        }
      });
    });

    // 删除任务历史记录
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM task_history WHERE taskId = ?', [id], function(err) {
        if (err) {
          console.error(`[${new Date().toLocaleString()}] [tasks.js] 删除任务历史记录失败:`, err);
          reject(err);
        } else {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 任务历史记录已从数据库删除，影响行数: ${this.changes}`);
          resolve(this.changes);
        }
      });
    });

    // 从活动任务列表中移除
    if (activeTasks.has(id)) {
      activeTasks.delete(id);
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 任务已从活动任务列表中移除: ${id}`);
    }

    console.log(`[${new Date().toLocaleString()}] [tasks.js] 任务删除操作完成: ${id}`);


    res.json({ message: '任务已删除' });
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({ message: '删除任务失败' });
  }
});

// 获取下载URL
router.get('/:id/download-url', async (req, res) => {
  try {
    const { id } = req.params;

    // 验证任务是否存在
    const task = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!task) {
      return res.status(404).json({ message: '任务不存在' });
    }

    // 验证权限（管理员可以下载所有任务，普通用户只能下载自己的任务）
    if (req.user.role !== 'admin' && task.username !== req.user.username) {
      return res.status(403).json({ message: '没有权限下载此任务' });
    }

    // 验证输出文件是否存在
    if (!task.outputFile) {
      return res.status(400).json({ message: '没有可下载的文件' });
    }

    // 检查文件是否存在
    if (!fs.existsSync(task.outputFile)) {
      return res.status(404).json({ message: '文件不存在' });
    }

    // 生成下载URL
    const fileName = path.basename(task.outputFile);
    const downloadUrl = `/downloads/${fileName}?token=${req.token}`;

    res.json({ url: downloadUrl });
  } catch (error) {
    console.error('获取下载URL失败:', error);
    res.status(500).json({ message: '获取下载URL失败' });
  }
});

module.exports = router;

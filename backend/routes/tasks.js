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

    // 删除任务相关的文件
    if (task.outputFile) {
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 尝试删除输出文件: ${task.outputFile}`);
      try {
        if (fs.existsSync(task.outputFile)) {
          fs.unlinkSync(task.outputFile);
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除输出文件: ${task.outputFile}`);
        } else {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 输出文件不存在: ${task.outputFile}`);
        }
      } catch (fileError) {
        console.error(`[${new Date().toLocaleString()}] [tasks.js] 删除输出文件失败:`, fileError);
      }
    }

    // 删除临时目录
    if (task.tempDir) {
      console.log(`[${new Date().toLocaleString()}] [tasks.js] 尝试删除临时目录: ${task.tempDir}`);
      try {
        if (fs.existsSync(task.tempDir)) {
          fs.rmSync(task.tempDir, { recursive: true, force: true });
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 成功删除临时目录: ${task.tempDir}`);
        } else {
          console.log(`[${new Date().toLocaleString()}] [tasks.js] 临时目录不存在: ${task.tempDir}`);
        }
      } catch (dirError) {
        console.error(`[${new Date().toLocaleString()}] [tasks.js] 删除临时目录失败:`, dirError);
        // 尝试使用命令行工具删除
        try {
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
        } catch (cmdError) {
          console.error(`[${new Date().toLocaleString()}] [tasks.js] 命令行删除也失败:`, cmdError);
        }
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

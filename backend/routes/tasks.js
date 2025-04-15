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
    
    // 验证权限（管理员可以删除所有任务，普通用户只能删除自己的任务）
    if (req.user.role !== 'admin' && task.username !== req.user.username) {
      return res.status(403).json({ message: '没有权限删除此任务' });
    }
    
    // 如果任务进程还在运行，先停止它
    const activeTasks = global.activeTasks || new Map();
    const activeTask = activeTasks.get(id);
    
    if (activeTask && activeTask.process) {
      try {
        activeTask.process.kill();
        console.log(`任务 ${id} 进程已终止`);
      } catch (killError) {
        console.error(`终止任务 ${id} 进程失败:`, killError);
      }
    }
    
    // 删除任务记录
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
    
    // 删除任务历史记录
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM task_history WHERE taskId = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
    
    // 从活动任务列表中移除
    if (activeTasks.has(id)) {
      activeTasks.delete(id);
    }
    
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

const express = require('express');
const router = express.Router();
const { db } = require('../models/database'); // 任务数据库
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// 连接用户数据库
const userDbPath = path.join(__dirname, '..', 'data', 'users.db');
const userDb = new sqlite3.Database(userDbPath, (err) => {
  if (err) {
    console.error('连接用户数据库失败:', err);
  } else {
    console.log('成功连接到用户数据库(仪表盘路由)');
  }
});

// 获取仪表盘统计数据
router.get('/stats', async (req, res) => {
  try {
    // 获取用户总数 - 从用户数据库获取
    const userCount = await new Promise((resolve, reject) => {
      userDb.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          console.error('获取用户总数失败:', err);
          reject(err);
        } else {
          console.log('获取到的用户总数:', row ? row.count : 0);
          resolve(row ? row.count : 0);
        }
      });
    });

    // 获取活跃任务数
    const activeTasksCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM tasks WHERE status = 'running'", (err, row) => {
        if (err) {
          console.error('获取活跃任务数失败:', err);
          reject(err);
        } else {
          console.log('获取到的活跃任务数:', row ? row.count : 0);
          resolve(row ? row.count : 0);
        }
      });
    });

    // 获取已完成任务数
    const completedTasksCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM tasks WHERE status IN ('completed', 'paused')", (err, row) => {
        if (err) {
          console.error('获取已完成任务数失败:', err);
          reject(err);
        } else {
          console.log('获取到的已完成任务数:', row ? row.count : 0);
          resolve(row ? row.count : 0);
        }
      });
    });

    // 计算存储使用情况
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    let storageUsed = 0;

    // 递归获取目录大小
    const getDirectorySize = (directory) => {
      try {
        const files = fs.readdirSync(directory);
        let size = 0;

        for (const file of files) {
          const filePath = path.join(directory, file);
          const stats = fs.statSync(filePath);

          if (stats.isDirectory()) {
            size += getDirectorySize(filePath);
          } else {
            size += stats.size;
          }
        }

        return size;
      } catch (error) {
        console.error('计算目录大小失败:', error);
        return 0;
      }
    };

    try {
      storageUsed = getDirectorySize(downloadsDir);
    } catch (error) {
      console.error('计算存储使用量失败:', error);
    }

    // 转换为可读格式
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    res.json({
      totalUsers: userCount,
      activeDownloads: activeTasksCount,
      completedTasks: completedTasksCount,
      storageUsed: formatBytes(storageUsed)
    });
  } catch (error) {
    console.error('获取仪表盘统计数据失败:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

// 获取最近任务
router.get('/recent-tasks', async (req, res) => {
  try {
    const tasks = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, url, status, createdAt, username, outputFile, fileSize FROM tasks ORDER BY createdAt DESC LIMIT 10',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json(tasks);
  } catch (error) {
    console.error('获取最近任务失败:', error);
    res.status(500).json({ message: '获取最近任务失败' });
  }
});

// 获取用户列表
router.get('/users', async (req, res) => {
  try {
    // 首先获取表结构信息
    const tableInfo = await new Promise((resolve, reject) => {
      userDb.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // 检查表结构中的列名
    const columns = tableInfo.map(col => col.name);
    console.log('用户表列名(仪表盘):', columns);

    // 构建查询语句
    const query = `SELECT ${columns.join(', ')} FROM users`;
    console.log('执行查询(仪表盘):', query);

    const users = await new Promise((resolve, reject) => {
      userDb.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json(users);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ message: '获取用户列表失败' });
  }
});

module.exports = router;

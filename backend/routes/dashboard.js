const express = require('express');
const router = express.Router();
const { db } = require('../models/database'); // 任务数据库
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const { spawn } = require('child_process');

// 文件系统操作的Promise版本
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);

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
          // console.log('获取到的用户总数:', row ? row.count : 0);
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
          // console.log('获取到的活跃任务数:', row ? row.count : 0);
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
          // console.log('获取到的已完成任务数:', row ? row.count : 0);
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

// 格式化文件大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 递归获取目录大小的辅助函数
async function getDirectorySize(directory) {
  try {
    const entries = await readdirAsync(directory);
    let size = 0;

    for (const entry of entries) {
      const entryPath = path.join(directory, entry);
      const stats = await statAsync(entryPath);

      if (stats.isDirectory()) {
        size += await getDirectorySize(entryPath);
      } else {
        size += stats.size;
      }
    }

    return size;
  } catch (error) {
    console.error(`计算目录 ${directory} 大小失败:`, error);
    return 0;
  }
}

// 递归获取目录内容和大小的辅助函数
async function getDirectoryContents(directory, includeSubdirs = true) {
  try {
    const entries = await readdirAsync(directory);
    const result = [];

    for (const entry of entries) {
      const entryPath = path.join(directory, entry);
      const stats = await statAsync(entryPath);
      const isDirectory = stats.isDirectory();

      // 基本信息
      const fileInfo = {
        name: entry,
        path: entryPath,
        isDirectory,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        relativePath: path.relative(path.join(__dirname, '..'), entryPath)
      };

      // 如果是目录且需要包含子目录内容
      if (isDirectory && includeSubdirs) {
        try {
          // 计算目录大小
          fileInfo.size = await getDirectorySize(entryPath);

          // 获取关联的任务信息
          const taskInfo = await getTaskByTempDir(entryPath);
          if (taskInfo) {
            fileInfo.taskId = taskInfo.id;
            fileInfo.taskUrl = taskInfo.url;
            fileInfo.taskStatus = taskInfo.status;
            fileInfo.taskCreatedAt = taskInfo.createdAt;
          }
        } catch (error) {
          console.error(`计算目录 ${entryPath} 大小失败:`, error);
        }
      }

      result.push(fileInfo);
    }

    return result;
  } catch (error) {
    console.error(`获取目录 ${directory} 内容失败:`, error);
    return [];
  }
}

// 根据临时目录路径查找关联的任务
async function getTaskByTempDir(tempDirPath) {
  try {
    // 1. 首先尝试直接匹配临时目录路径
    const exactMatch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE tempDir = ?', [tempDirPath], (err, row) => {
        if (err) {
          console.error('查询任务失败:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (exactMatch) {
      return exactMatch;
    }

    // 2. 如果没有直接匹配，尝试使用LIKE查询
    const dirName = path.basename(tempDirPath);
    const likeMatch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE tempDir LIKE ?', [`%${dirName}%`], (err, row) => {
        if (err) {
          console.error('使用LIKE查询任务失败:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (likeMatch) {
      return likeMatch;
    }

    // 3. 如果还是没有匹配，尝试使用目录名中的日期时间部分进行匹配
    const dateTimeMatch = dirName.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
    if (dateTimeMatch) {
      const dateTimePart = dateTimeMatch[1];
      const dateTimeResult = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM tasks WHERE outputFile LIKE ?', [`%${dateTimePart}%`], (err, row) => {
          if (err) {
            console.error('使用日期时间查询任务失败:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });

      if (dateTimeResult) {
        return dateTimeResult;
      }
    }

    // 4. 如果还是没有匹配，尝试使用目录名中的任务ID进行匹配
    const taskIdMatch = dirName.match(/(\d{13,})/);
    if (taskIdMatch) {
      const taskId = taskIdMatch[1];
      const taskIdResult = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
          if (err) {
            console.error('使用任务ID查询任务失败:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });

      if (taskIdResult) {
        return taskIdResult;
      }
    }

    return null;
  } catch (error) {
    console.error('查找临时目录关联任务失败:', error);
    return null;
  }
}

// 获取下载目录文件列表
router.get('/download-files', async (req, res) => {
  try {
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    const files = await getDirectoryContents(downloadsDir, false);

    // 计算总大小
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    res.json({
      files,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    });
  } catch (error) {
    console.error('获取下载文件列表失败:', error);
    res.status(500).json({ message: '获取下载文件列表失败' });
  }
});

// 获取临时目录文件列表
router.get('/temp-files', async (req, res) => {
  try {
    const tempDir = path.join(__dirname, '..', 'temp');
    const files = await getDirectoryContents(tempDir, true);

    // 计算总大小
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    res.json({
      files,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    });
  } catch (error) {
    console.error('获取临时文件列表失败:', error);
    res.status(500).json({ message: '获取临时文件列表失败' });
  }
});

// 删除下载文件
router.delete('/download-file', async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ message: '缺少文件路径参数' });
    }

    // 安全检查：确保文件在下载目录中
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    const absolutePath = path.resolve(filePath);

    if (!absolutePath.startsWith(downloadsDir)) {
      return res.status(403).json({ message: '无法删除下载目录外的文件' });
    }

    // 检查文件是否存在
    const exists = fs.existsSync(absolutePath);
    if (!exists) {
      return res.status(404).json({ message: '文件不存在' });
    }

    // 删除文件
    await unlinkAsync(absolutePath);
    res.json({ message: '文件已成功删除' });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ message: '删除文件失败', error: error.message });
  }
});

// 删除临时文件夹
router.delete('/temp-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({ message: '缺少文件夹路径参数' });
    }

    // 安全检查：确保文件夹在临时目录中
    const tempDir = path.join(__dirname, '..', 'temp');
    const absolutePath = path.resolve(folderPath);

    if (!absolutePath.startsWith(tempDir)) {
      return res.status(403).json({ message: '无法删除临时目录外的文件夹' });
    }

    // 检查文件夹是否存在
    const exists = fs.existsSync(absolutePath);
    if (!exists) {
      return res.status(404).json({ message: '文件夹不存在' });
    }

    // 递归删除文件夹
    await deleteDirectory(absolutePath);
    res.json({ message: '文件夹已成功删除' });
  } catch (error) {
    console.error('删除文件夹失败:', error);
    res.status(500).json({ message: '删除文件夹失败', error: error.message });
  }
});

// 清理所有临时文件
router.delete('/clean-temp', async (req, res) => {
  try {
    const tempDir = path.join(__dirname, '..', 'temp');
    const entries = await readdirAsync(tempDir);

    // 获取活跃任务列表
    const activeTasks = await new Promise((resolve, reject) => {
      db.all("SELECT id, tempDir FROM tasks WHERE status = 'running'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // 活跃任务的临时目录路径集合
    const activeTempDirs = new Set(activeTasks.map(task => task.tempDir).filter(Boolean));

    let deletedCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
      const entryPath = path.join(tempDir, entry);
      const stats = await statAsync(entryPath);

      // 跳过活跃任务的临时目录
      if (stats.isDirectory() && activeTempDirs.has(entryPath)) {
        console.log(`跳过活跃任务的临时目录: ${entryPath}`);
        continue;
      }

      try {
        if (stats.isDirectory()) {
          await deleteDirectory(entryPath);
        } else {
          await unlinkAsync(entryPath);
        }
        deletedCount++;
      } catch (error) {
        console.error(`删除 ${entryPath} 失败:`, error);
        errorCount++;
      }
    }

    res.json({
      message: `清理完成，成功删除 ${deletedCount} 项，失败 ${errorCount} 项`,
      deletedCount,
      errorCount
    });
  } catch (error) {
    console.error('清理临时文件失败:', error);
    res.status(500).json({ message: '清理临时文件失败', error: error.message });
  }
});

// 递归删除目录的辅助函数
async function deleteDirectory(dirPath) {
  try {
    const entries = await readdirAsync(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stats = await statAsync(entryPath);

      if (stats.isDirectory()) {
        await deleteDirectory(entryPath);
      } else {
        await unlinkAsync(entryPath);
      }
    }

    await rmdirAsync(dirPath);
    return true;
  } catch (error) {
    console.error(`删除目录 ${dirPath} 失败:`, error);

    // 尝试使用命令行工具删除
    try {
      if (process.platform === 'win32') {
        // Windows下使用rd命令
        spawn('cmd', ['/c', 'rd', '/s', '/q', dirPath]);
      } else {
        // Linux/Mac下使用rm命令
        spawn('rm', ['-rf', dirPath]);
      }
      return true;
    } catch (cmdError) {
      console.error(`命令行删除目录 ${dirPath} 失败:`, cmdError);
      throw error; // 抛出原始错误
    }
  }
}

module.exports = router;

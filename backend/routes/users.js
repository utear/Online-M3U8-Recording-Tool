const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 使用正确的用户数据库文件
const dbPath = path.join(__dirname, '..', 'data', 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('连接用户数据库失败:', err);
  } else {
    console.log('成功连接到用户数据库(用户路由)');
  }
});

// 获取所有用户
router.get('/', async (req, res) => {
  try {
    // 首先获取表结构信息
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // 检查表结构中的列名
    const columns = tableInfo.map(col => col.name);
    console.log('用户表列名:', columns);

    // 构建查询语句
    const query = `SELECT ${columns.join(', ')} FROM users`;
    console.log('执行查询:', query);

    const users = await new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
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

// 获取单个用户
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 首先获取表结构信息
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // 检查表结构中的列名
    const columns = tableInfo.map(col => col.name);

    // 构建查询语句
    const query = `SELECT ${columns.join(', ')} FROM users WHERE username = ?`;

    const user = await new Promise((resolve, reject) => {
      db.get(query, [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json(user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// 创建新用户
router.post('/', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    // 验证角色
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: '无效的用户角色' });
    }

    // 检查用户是否已存在
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建用户
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role || 'user'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.status(201).json({
      message: '用户创建成功',
      userId: result
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({ message: '创建用户失败' });
  }
});

// 更新用户
router.put('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { role, password } = req.body;

    // 检查用户是否存在
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 如果提供了角色，验证角色
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: '无效的用户角色' });
    }

    // 如果提供了密码，加密密码
    let hashedPassword;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // 构建更新SQL
    let sql = 'UPDATE users SET';
    const params = [];
    const updates = [];

    if (role) {
      updates.push(' role = ?');
      params.push(role);
    }

    if (hashedPassword) {
      updates.push(' password = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: '没有提供要更新的字段' });
    }

    sql += updates.join(',');
    sql += ' WHERE username = ?';
    params.push(username);

    // 更新用户
    await new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ message: '更新用户失败' });
  }
});

// 删除用户
router.delete('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 检查用户是否存在
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 删除用户
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE username = ?', [username], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ message: '删除用户失败' });
  }
});

module.exports = router;

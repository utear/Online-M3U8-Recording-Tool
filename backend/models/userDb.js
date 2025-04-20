const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'users.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接用户数据库失败:', err);
    } else {
        console.log('成功连接到用户数据库');
    }
});

// 初始化用户表
async function initUserTable() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'pending',
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('用户表初始化成功');
  } catch (error) {
    console.error('初始化用户表失败:', error);
    throw error;
  }
}

initUserTable().catch(console.error);

// 验证用户
async function validateUser(username, password) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE username = ?',
            [username],
            async (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!user) {
                    resolve(null);
                    return;
                }

                try {
                    const isValid = await bcrypt.compare(password, user.password);
                    if (!isValid) {
                        resolve(null);
                        return;
                    }

                    // 检查用户是否启用
                    if (user.enabled === 0) {
                        resolve({
                            id: user.id,
                            username: user.username,
                            role: user.role,
                            status: user.status,
                            enabled: false,
                            message: '账号已被禁用'
                        });
                        return;
                    }

                    // 检查用户状态
                    if (user.status === 'pending') {
                        resolve({
                            id: user.id,
                            username: user.username,
                            role: user.role,
                            status: 'pending',
                            enabled: !!user.enabled
                        });
                        return;
                    } else if (user.status === 'rejected') {
                        resolve({
                            id: user.id,
                            username: user.username,
                            role: user.role,
                            status: 'rejected',
                            enabled: false
                        });
                        return;
                    }

                    // 用户已批准
                    resolve({
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        status: user.status || 'approved',
                        enabled: !!user.enabled
                    });
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

// 获取用户信息
async function getUser(username) {
  try {
    return await new Promise((resolve, reject) => {
      db.get('SELECT id, username, role, status, enabled, created_at FROM users WHERE username = ?',
        [username],
        (err, user) => {
          if (err) reject(err);
          else resolve(user);
        }
      );
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
}

// 注册新用户
async function registerUser(username, password) {
  try {
    // 添加日志
    console.log('开始注册用户:', username);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('密码已加密');

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, role, status, enabled) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, 'user', 'pending', 1],
        function(err) {
          if (err) {
            console.error('插入用户数据失败:', err);
            reject(err);
          } else {
            console.log('用户注册成功，ID:', this.lastID, '状态: 待审核');
            resolve(this.lastID);
          }
        }
      );
    });

    return { success: true, status: 'pending' };
  } catch (error) {
    console.error('注册用户失败:', error);
    throw error;
  }
}

// 更新用户状态
async function updateUserStatus(username, status) {
  try {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new Error('无效的用户状态');
    }

    // 如果状态是拒绝，同时禁用用户
    const enabled = status === 'rejected' ? 0 : 1;

    return await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET status = ?, enabled = ? WHERE username = ?',
        [status, enabled, username],
        function(err) {
          if (err) {
            console.error('更新用户状态失败:', err);
            reject(err);
          } else {
            console.log(`用户 ${username} 状态已更新为: ${status}, 启用状态: ${enabled ? '启用' : '禁用'}`);
            resolve({ success: true });
          }
        }
      );
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    throw error;
  }
}

// 获取所有待审核用户
async function getPendingUsers() {
  try {
    return await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, username, role, status, enabled, created_at FROM users WHERE status = "pending"',
        (err, users) => {
          if (err) {
            console.error('获取待审核用户失败:', err);
            reject(err);
          } else {
            resolve(users || []);
          }
        }
      );
    });
  } catch (error) {
    console.error('获取待审核用户失败:', error);
    throw error;
  }
}

// 获取所有用户
async function getAllUsers() {
  try {
    return await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, username, role, status, enabled, created_at FROM users',
        (err, users) => {
          if (err) {
            console.error('获取所有用户失败:', err);
            reject(err);
          } else {
            resolve(users || []);
          }
        }
      );
    });
  } catch (error) {
    console.error('获取所有用户失败:', error);
    throw error;
  }
}

// 启用/禁用用户
async function toggleUserEnabled(username, enabled) {
  try {
    return await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET enabled = ? WHERE username = ?',
        [enabled ? 1 : 0, username],
        function(err) {
          if (err) {
            console.error('更新用户启用状态失败:', err);
            reject(err);
          } else {
            console.log(`用户 ${username} 启用状态已更新为: ${enabled ? '启用' : '禁用'}`);
            resolve({ success: true });
          }
        }
      );
    });
  } catch (error) {
    console.error('更新用户启用状态失败:', error);
    throw error;
  }
}

module.exports = {
  validateUser,
  getUser,
  registerUser,
  updateUserStatus,
  getPendingUsers,
  getAllUsers,
  toggleUserEnabled
};

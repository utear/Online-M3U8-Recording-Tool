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
                    resolve(isValid ? {
                        id: user.id,
                        username: user.username,
                        role: user.role  // 确保返回用户角色
                    } : null);
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
      db.get('SELECT id, username, role, created_at FROM users WHERE username = ?', 
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
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, 'user'],
        function(err) {
          if (err) {
            console.error('插入用户数据失败:', err);
            reject(err);
          } else {
            console.log('用户注册成功，ID:', this.lastID);
            resolve(this.lastID);
          }
        }
      );
    });

    return { success: true };
  } catch (error) {
    console.error('注册用户失败:', error);
    throw error;
  }
}

module.exports = {
  validateUser,
  getUser,
  registerUser
};

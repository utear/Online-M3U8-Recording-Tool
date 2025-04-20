const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'users.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接数据库失败:', err);
        process.exit(1);
    }
    console.log('成功连接到用户数据库');
    initAdminUser();
});

// 初始化管理员用户
function initAdminUser() {
    // 创建用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT DEFAULT 'approved',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, async (err) => {
        if (err) {
            console.error('创建用户表失败:', err);
            process.exit(1);
        }

        // 管理员账号配置
        const adminUser = {
            username: 'admin',  // 在这里修改管理员用户名
            password: 'a262015622',  // 在这里修改管理员密码
            role: 'admin'
        };

        try {
            // 加密密码
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminUser.password, salt);

            // 检查管理员是否已存在
            db.get('SELECT id FROM users WHERE username = ?', [adminUser.username], (err, row) => {
                if (err) {
                    console.error('查询用户失败:', err);
                    process.exit(1);
                }

                if (!row) {
                    // 插入管理员用户
                    db.run('INSERT INTO users (username, password, role, status, enabled) VALUES (?, ?, ?, ?, ?)',
                        [adminUser.username, hashedPassword, adminUser.role, 'approved', 1],
                        (err) => {
                            if (err) {
                                console.error('创建管理员用户失败:', err);
                            } else {
                                console.log('管理员用户创建成功！');
                                console.log('用户名:', adminUser.username);
                                console.log('密码:', adminUser.password);
                            }
                            process.exit(err ? 1 : 0);
                        }
                    );
                } else {
                    console.log('管理员用户已存在');
                    process.exit(0);
                }
            });
        } catch (error) {
            console.error('创建管理员用户失败:', error);
            process.exit(1);
        }
    });
}

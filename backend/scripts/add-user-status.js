const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'users.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接用户数据库失败:', err);
        process.exit(1);
    } else {
        console.log('成功连接到用户数据库');
        
        // 添加 status 列
        db.run('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "approved"', (err) => {
            if (err) {
                // 如果列已存在，SQLite 会报错
                console.error('添加 status 列失败:', err);
            } else {
                console.log('成功添加 status 列到 users 表');
                
                // 将现有用户的状态设置为已批准
                db.run('UPDATE users SET status = "approved" WHERE status IS NULL', (err) => {
                    if (err) {
                        console.error('更新现有用户状态失败:', err);
                    } else {
                        console.log('已将现有用户状态设置为已批准');
                    }
                    
                    // 关闭数据库连接
                    db.close(() => {
                        console.log('数据库连接已关闭');
                    });
                });
            }
        });
    }
});

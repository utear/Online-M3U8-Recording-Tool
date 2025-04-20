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
        
        // 添加 enabled 列
        db.run('ALTER TABLE users ADD COLUMN enabled INTEGER DEFAULT 1', (err) => {
            if (err) {
                // 如果列已存在，SQLite 会报错
                console.error('添加 enabled 列失败:', err);
            } else {
                console.log('成功添加 enabled 列到 users 表');
                
                // 将现有用户的状态设置为启用
                db.run('UPDATE users SET enabled = 1 WHERE enabled IS NULL', (err) => {
                    if (err) {
                        console.error('更新现有用户启用状态失败:', err);
                    } else {
                        console.log('已将现有用户启用状态设置为启用');
                    }
                    
                    // 将被拒绝的用户设置为禁用状态
                    db.run('UPDATE users SET enabled = 0 WHERE status = "rejected"', (err) => {
                        if (err) {
                            console.error('更新被拒绝用户启用状态失败:', err);
                        } else {
                            console.log('已将被拒绝用户启用状态设置为禁用');
                        }
                        
                        // 关闭数据库连接
                        db.close(() => {
                            console.log('数据库连接已关闭');
                        });
                    });
                });
            }
        });
    }
});

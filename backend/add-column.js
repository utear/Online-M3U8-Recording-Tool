const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'data', 'tasks.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接数据库失败:', err);
        process.exit(1);
    } else {
        console.log('成功连接到数据库');
        
        // 添加 groupId 列
        db.run('ALTER TABLE tasks ADD COLUMN groupId TEXT', (err) => {
            if (err) {
                // 如果列已存在，SQLite 会报错
                console.error('添加 groupId 列失败:', err);
            } else {
                console.log('成功添加 groupId 列到 tasks 表');
            }
            
            // 添加外键约束
            db.run('PRAGMA foreign_keys = ON', () => {
                console.log('已启用外键约束');
                
                // 关闭数据库连接
                db.close(() => {
                    console.log('数据库连接已关闭');
                });
            });
        });
    }
});

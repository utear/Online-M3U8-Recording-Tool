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
        
        // 添加 tempDir 列
        db.run('ALTER TABLE tasks ADD COLUMN tempDir TEXT', (err) => {
            if (err) {
                // 如果列已存在，SQLite 会报错
                console.error('添加 tempDir 列失败:', err);
            } else {
                console.log('成功添加 tempDir 列到 tasks 表');
            }
            
            // 关闭数据库连接
            db.close(() => {
                console.log('数据库连接已关闭');
            });
        });
    }
});

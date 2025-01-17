const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'tasks.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('连接数据库失败:', err);
    } else {
        console.log('成功连接到数据库');
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    db.serialize(() => {
        // 创建用户表
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL
            )
        `);

        // 创建任务表
        db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                url TEXT NOT NULL,
                status TEXT NOT NULL,
                lastOutput TEXT,
                createdAt TEXT NOT NULL,
                outputFile TEXT,
                fileSize INTEGER DEFAULT 0,
                options TEXT,
                FOREIGN KEY(username) REFERENCES users(username)
            )
        `);

        // 创建任务历史记录表
        db.run(`
            CREATE TABLE IF NOT EXISTS task_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                taskId TEXT NOT NULL,
                output TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY(taskId) REFERENCES tasks(id)
            )
        `);
    });
}

// 添加新任务
function addTask(task) {
    return new Promise((resolve, reject) => {
        const { id, username, url, status, lastOutput, createdAt, outputFile, options } = task;
        
        if (!id || !username || !url) {
            return reject(new Error('id, username 和 url 是必需的'));
        }

        console.log('添加任务:', task);
        
        const stmt = db.prepare(`
            INSERT INTO tasks (
                id, username, url, status, lastOutput, 
                createdAt, outputFile, options
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            id,
            username,
            url,
            status || 'pending',
            lastOutput || '',
            createdAt || new Date().toISOString(),
            outputFile || '',
            options || '{}',
            function(err) {
                if (err) {
                    console.error('添加任务失败:', err);
                    reject(err);
                } else {
                    console.log('任务添加成功, ID:', this.lastID);
                    resolve(this.lastID);
                }
            }
        );
        stmt.finalize();
    });
}

// 更新任务状态
function updateTaskStatus(taskId, status, lastOutput = null) {
    return new Promise((resolve, reject) => {
        const updates = [];
        const params = [];
        
        if (status) {
            updates.push('status = ?');
            params.push(status);
        }
        if (lastOutput !== null) {
            updates.push('lastOutput = ?');
            params.push(lastOutput);
        }
        
        if (updates.length === 0) {
            resolve();
            return;
        }
        
        params.push(taskId);
        const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// 更新任务输出文件
function updateTaskOutput(taskId, outputFile, fileSize = 0) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE tasks SET outputFile = ?, fileSize = ? WHERE id = ?',
            [outputFile, fileSize, taskId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

// 获取所有任务
async function getAllTasks(username, isAdmin = false) {
    return new Promise((resolve, reject) => {
        let sql = 'SELECT * FROM tasks';
        let params = [];

        // 如果不是管理员，只获取自己的任务
        if (!isAdmin) {
            sql += ' WHERE username = ?';
            params.push(username);
        }

        sql += ' ORDER BY createdAt DESC';
        
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('获取任务列表失败:', err);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// 添加任务历史记录
function addTaskHistory(taskId, output) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        db.run(
            'INSERT INTO task_history (taskId, output, timestamp) VALUES (?, ?, ?)',
            [taskId, output, timestamp],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// 获取任务历史记录
function getTaskHistory(taskId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM task_history WHERE taskId = ? ORDER BY timestamp DESC',
            [taskId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = {
    db,
    addTask,
    updateTaskStatus,
    updateTaskOutput,
    getAllTasks,
    addTaskHistory,
    getTaskHistory
};

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
        // 创建任务表
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            status TEXT NOT NULL,
            lastOutput TEXT,
            createdAt TEXT NOT NULL,
            outputFile TEXT,
            fileSize INTEGER DEFAULT 0,
            options TEXT
        )`);

        // 创建任务历史记录表
        db.run(`CREATE TABLE IF NOT EXISTS task_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            taskId TEXT NOT NULL,
            output TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(taskId) REFERENCES tasks(id)
        )`);
    });
}

// 添加新任务
function addTask(task) {
    return new Promise((resolve, reject) => {
        const { id, url, status, lastOutput, createdAt, outputFile, options } = task;
        const stmt = db.prepare(`
            INSERT INTO tasks (id, url, status, lastOutput, createdAt, outputFile, options)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            id,
            url,
            status,
            lastOutput || '',
            createdAt,
            outputFile || '',
            JSON.stringify(options),
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
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
function getAllTasks() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM tasks ORDER BY createdAt DESC', [], (err, rows) => {
            if (err) reject(err);
            else {
                // 解析存储的JSON选项
                const tasks = rows.map(row => ({
                    ...row,
                    options: row.options ? JSON.parse(row.options) : {}
                }));
                resolve(tasks);
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

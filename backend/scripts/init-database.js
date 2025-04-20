/**
 * 数据库初始化脚本
 *
 * 此脚本整合了所有数据库升级脚本，确保数据库表结构包含所有必要的字段
 * 在项目首次运行时自动执行，无需用户手动运行多个脚本
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const tasksDbPath = path.join(__dirname, '..', 'data', 'tasks.db');
const usersDbPath = path.join(__dirname, '..', 'data', 'users.db');

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('已创建数据目录:', dataDir);
}

// 初始化任务数据库
function initTasksDb() {
    return new Promise((resolve, reject) => {
        console.log('正在初始化任务数据库...');

        const db = new sqlite3.Database(tasksDbPath, (err) => {
            if (err) {
                console.error('连接任务数据库失败:', err);
                reject(err);
                return;
            }

            console.log('成功连接到任务数据库');

            db.serialize(() => {
                // 创建任务组表
                db.run(`
                    CREATE TABLE IF NOT EXISTS task_groups (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        username TEXT NOT NULL,
                        createdAt TEXT NOT NULL,
                        status TEXT NOT NULL,
                        taskCount INTEGER DEFAULT 0
                    )
                `, (err) => {
                    if (err) {
                        console.error('创建任务组表失败:', err);
                    } else {
                        console.log('任务组表初始化成功');
                    }
                });

                // 创建任务表，包含所有必要字段
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
                        groupId TEXT,
                        tempDir TEXT
                    )
                `, (err) => {
                    if (err) {
                        console.error('创建任务表失败:', err);
                    } else {
                        console.log('任务表初始化成功');
                    }
                });

                // 创建任务历史记录表
                db.run(`
                    CREATE TABLE IF NOT EXISTS task_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        taskId TEXT NOT NULL,
                        output TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    )
                `, (err) => {
                    if (err) {
                        console.error('创建任务历史记录表失败:', err);
                    } else {
                        console.log('任务历史记录表初始化成功');
                    }
                });

                // 检查任务表是否已有tempDir列
                db.all("PRAGMA table_info(tasks)", (err, rows) => {
                    if (err) {
                        console.error('查询任务表结构失败:', err);
                    } else {
                        console.log('任务表结构:', rows);
                        // 如果没有tempDir列，添加它
                        const hasTempDir = Array.isArray(rows) && rows.some(row => row.name === 'tempDir');
                        if (!hasTempDir) {
                            db.run('ALTER TABLE tasks ADD COLUMN tempDir TEXT', (err) => {
                                if (err) {
                                    console.error('添加tempDir列失败:', err);
                                } else {
                                    console.log('成功添加tempDir列到tasks表');
                                }
                            });
                        }

                        // 如果没有groupId列，添加它
                        const hasGroupId = Array.isArray(rows) && rows.some(row => row.name === 'groupId');
                        if (!hasGroupId) {
                            db.run('ALTER TABLE tasks ADD COLUMN groupId TEXT', (err) => {
                                if (err) {
                                    console.error('添加groupId列失败:', err);
                                } else {
                                    console.log('成功添加groupId列到tasks表');
                                }
                            });
                        }
                    }
                });
            });

            // 完成初始化
            db.close((err) => {
                if (err) {
                    console.error('关闭任务数据库连接失败:', err);
                    reject(err);
                } else {
                    console.log('任务数据库初始化完成');
                    resolve();
                }
            });
        });
    });
}

// 初始化用户数据库
function initUsersDb() {
    return new Promise((resolve, reject) => {
        console.log('正在初始化用户数据库...');

        const db = new sqlite3.Database(usersDbPath, (err) => {
            if (err) {
                console.error('连接用户数据库失败:', err);
                reject(err);
                return;
            }

            console.log('成功连接到用户数据库');

            // 创建用户表，包含所有必要字段
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    status TEXT DEFAULT 'pending',
                    enabled INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('创建用户表失败:', err);
                } else {
                    console.log('用户表初始化成功');
                }

                // 检查用户表是否已有status和enabled列
                db.all("PRAGMA table_info(users)", (err, rows) => {
                    if (err) {
                        console.error('查询用户表结构失败:', err);
                    } else {
                        console.log('用户表结构:', rows);
                        // 如果没有status列，添加它
                        const hasStatus = Array.isArray(rows) && rows.some(row => row.name === 'status');
                        if (!hasStatus) {
                            db.run('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "approved"', (err) => {
                                if (err) {
                                    console.error('添加status列失败:', err);
                                } else {
                                    console.log('成功添加status列到users表');

                                    // 将现有用户的状态设置为已批准
                                    db.run('UPDATE users SET status = "approved" WHERE status IS NULL', (err) => {
                                        if (err) {
                                            console.error('更新现有用户状态失败:', err);
                                        } else {
                                            console.log('已将现有用户状态设置为已批准');
                                        }
                                    });
                                }
                            });
                        }

                        // 如果没有enabled列，添加它
                        const hasEnabled = Array.isArray(rows) && rows.some(row => row.name === 'enabled');
                        if (!hasEnabled) {
                            db.run('ALTER TABLE users ADD COLUMN enabled INTEGER DEFAULT 1', (err) => {
                                if (err) {
                                    console.error('添加enabled列失败:', err);
                                } else {
                                    console.log('成功添加enabled列到users表');

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
                                        });
                                    });
                                }
                            });
                        }
                    }
                });
            });

            // 完成初始化
            setTimeout(() => {
                db.close((err) => {
                    if (err) {
                        console.error('关闭用户数据库连接失败:', err);
                        reject(err);
                    } else {
                        console.log('用户数据库初始化完成');
                        resolve();
                    }
                });
            }, 1000); // 延迟关闭，确保所有操作完成
        });
    });
}

// 主函数
async function main() {
    try {
        console.log('开始初始化数据库...');

        // 初始化任务数据库
        await initTasksDb();

        // 初始化用户数据库
        await initUsersDb();

        console.log('数据库初始化完成！');
    } catch (error) {
        console.error('数据库初始化失败:', error);
    }
}

// 执行主函数
main();

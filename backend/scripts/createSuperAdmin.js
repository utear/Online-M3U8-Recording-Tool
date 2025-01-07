const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const createSuperAdmin = async () => {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    const usersFile = path.join(dataDir, 'users.json');

    // 确保data目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 读取现有用户数据
    let users = [];
    if (fs.existsSync(usersFile)) {
      const data = fs.readFileSync(usersFile, 'utf8');
      users = JSON.parse(data);
    }

    // 检查是否已存在超级管理员
    const existingSuperAdmin = users.find(user => user.role === 'superadmin');
    if (existingSuperAdmin) {
      console.log('超级管理员已存在！');
      return;
    }

    // 创建超级管理员
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const superAdmin = {
      id: Date.now().toString(),
      username: 'superadmin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'superadmin',
      isActive: true
    };

    // 添加到用户列表
    users.push(superAdmin);

    // 保存到文件
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    console.log('超级管理员创建成功！');
    console.log('邮箱: admin@example.com');
    console.log('密码: Admin123!');
    console.log('请登录后立即修改密码！');
  } catch (error) {
    console.error('创建超级管理员失败:', error);
  }
};

createSuperAdmin();

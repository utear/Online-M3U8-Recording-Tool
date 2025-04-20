const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { validateUser, getUser, registerUser, updateUserStatus, getPendingUsers, getAllUsers, toggleUserEnabled } = require('../models/userDb');

/**
 * 注册路由 - 创建新用户
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    console.log('[AUTH] 收到注册请求:', req.body);
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      console.log('[AUTH] 注册失败: 用户名或密码为空');
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    // 检查用户是否已存在
    const existingUser = await getUser(username);
    if (existingUser) {
      console.log('[AUTH] 注册失败: 用户名已存在');
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 创建新用户
    const result = await registerUser(username, password);
    console.log('[AUTH] 注册成功:', username, '状态: 待审核');
    res.status(201).json({
      message: '注册成功，请等待管理员审核后登录',
      status: 'pending'
    });
  } catch (error) {
    console.error('[AUTH] 注册错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/**
 * 登录路由 - 验证用户并生成token
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    console.log('[AUTH] 收到登录请求:', req.body);
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      console.log('[AUTH] 登录失败: 用户名或密码为空');
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }

    // 验证用户
    const user = await validateUser(username, password);
    if (!user) {
      console.log('[AUTH] 登录失败: 用户名或密码错误');
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 检查用户状态
    if (user.status === 'pending') {
      console.log('[AUTH] 登录失败: 用户待审核', username);
      return res.status(403).json({
        message: '您的账号正在审核中，请等待管理员审核后登录',
        status: 'pending'
      });
    } else if (user.status === 'rejected') {
      console.log('[AUTH] 登录失败: 用户已被拒绝', username);
      return res.status(403).json({
        message: '您的账号注册申请已被拒绝',
        status: 'rejected'
      });
    }

    // 生成 JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('[AUTH] 登录成功:', username);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status || 'approved'
      }
    });
  } catch (error) {
    console.error('[AUTH] 登录错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/**
 * 刷新token路由 - 刷新用户的JWT token
 * POST /api/auth/refresh-token
 */
router.post('/refresh-token', async (req, res) => {
  try {
    console.log('[AUTH] 收到刷新token请求');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('[AUTH] 刷新token失败: 未提供token');
      return res.status(401).json({ message: '未授权' });
    }

    // 即使token过期也尝试解码
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.decode(token);
    if (!decoded) {
      console.log('[AUTH] 刷新token失败: 无效的token');
      return res.status(403).json({ message: '无效的token' });
    }

    // 获取用户信息
    const user = await getUser(decoded.username);
    if (!user) {
      console.log('[AUTH] 刷新token失败: 用户不存在');
      return res.status(403).json({ message: '用户不存在' });
    }

    // 生成新token
    const newToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status || 'approved'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('[AUTH] 刷新token成功:', user.username);
    res.json({ token: newToken });
  } catch (error) {
    console.error('[AUTH] 刷新token错误:', error);
    res.status(403).json({ message: '刷新token失败' });
  }
});

/**
 * 获取待审核用户列表
 * GET /api/auth/pending-users
 */
router.get('/pending-users', async (req, res) => {
  try {
    console.log('[AUTH] 获取待审核用户列表');
    const pendingUsers = await getPendingUsers();
    res.json(pendingUsers);
  } catch (error) {
    console.error('[AUTH] 获取待审核用户列表错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/**
 * 管理员审核用户路由 - 批准或拒绝用户注册
 * POST /api/auth/approve-user
 */
router.post('/approve-user', async (req, res) => {
  try {
    console.log('[AUTH] 收到审核用户请求:', req.body);
    const { username, approved } = req.body;

    // 验证输入
    if (!username || approved === undefined) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 检查用户是否存在
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 更新用户状态
    const status = approved ? 'approved' : 'rejected';
    await updateUserStatus(username, status);

    console.log(`[AUTH] 用户 ${username} 审核${approved ? '通过' : '拒绝'}`);
    res.json({
      message: `用户 ${username} 已${approved ? '批准' : '拒绝'}`,
      status
    });
  } catch (error) {
    console.error('[AUTH] 审核用户错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/**
 * 获取所有用户列表
 * GET /api/auth/users
 */
router.get('/users', async (req, res) => {
  try {
    console.log('[AUTH] 获取所有用户列表');
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('[AUTH] 获取所有用户列表错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

/**
 * 启用/禁用用户路由
 * POST /api/auth/toggle-user
 */
router.post('/toggle-user', async (req, res) => {
  try {
    console.log('[AUTH] 收到启用/禁用用户请求:', req.body);
    const { username, enabled } = req.body;

    // 验证输入
    if (!username || enabled === undefined) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 检查用户是否存在
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 更新用户启用状态
    await toggleUserEnabled(username, enabled);

    console.log(`[AUTH] 用户 ${username} 已${enabled ? '启用' : '禁用'}`);
    res.json({
      message: `用户 ${username} 已${enabled ? '启用' : '禁用'}`,
      enabled
    });
  } catch (error) {
    console.error('[AUTH] 启用/禁用用户错误:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

module.exports = router;

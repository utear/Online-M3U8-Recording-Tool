const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { validateUser, getUser, registerUser } = require('../models/userDb');

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
    await registerUser(username, password);
    console.log('[AUTH] 注册成功:', username);
    res.status(201).json({ message: '注册成功' });
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
        role: user.role
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
        role: user.role
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

module.exports = router;

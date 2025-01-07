const jwt = require('jsonwebtoken');
const User = require('../models/user');

// 验证 JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId });

    if (!user || !user.isActive) {
      throw new Error();
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '请先登录' });
  }
};

// 验证超级管理员权限
const superAdminAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: '需要超级管理员权限' });
    }
    next();
  } catch (error) {
    res.status(403).json({ message: '权限验证失败' });
  }
};

// 验证管理员权限（包括超级管理员）
const adminAuth = async (req, res, next) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: '需要管理员权限' });
    }
    next();
  } catch (error) {
    res.status(403).json({ message: '权限验证失败' });
  }
};

module.exports = {
  auth,
  superAdminAuth,
  adminAuth
};

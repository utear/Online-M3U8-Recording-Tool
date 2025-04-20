/**
 * CORS中间件 - 处理跨域资源共享
 */

// CORS中间件函数
function corsMiddleware(req, res, next) {
  // 获取请求的Origin
  const origin = req.headers.origin;
  
  // 记录请求信息，便于调试
  console.log(`[CORS] 收到请求: ${req.method} ${req.url}`);
  console.log(`[CORS] 请求来源: ${origin || '未提供'}`);
  
  // 从环境变量获取允许的域名列表
  const allowedOriginsStr = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3005';
  const allowedOrigins = allowedOriginsStr.split(',').map(origin => origin.trim());
  
  // 允许所有请求源 - 生产环境中可能需要更严格的控制
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // 如果是OPTIONS请求，直接返回200
  if (req.method === 'OPTIONS') {
    console.log('[CORS] 响应OPTIONS预检请求');
    return res.status(200).end();
  }
  
  // 继续处理请求
  next();
}

module.exports = corsMiddleware;

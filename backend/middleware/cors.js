/**
 * 简化版CORS中间件 - 处理跨域资源共享
 * 这个中间件完全允许所有跨域请求，不考虑安全限制
 */
function corsMiddleware(req, res, next) {
  // 获取请求的Origin
  const origin = req.headers.origin;

  // 记录请求信息，便于调试
  // console.log(`[CORS] 请求: ${req.method} ${req.url} 来源: ${origin || '未提供'}`);

  // 对所有请求都设置允许跨域的头部
  // 如果有Origin头部，则使用该值，否则使用*
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24小时内不再发送预检请求

  // 如果是OPTIONS请求，直接返回200
  if (req.method === 'OPTIONS') {
    // console.log(`[CORS] 响应OPTIONS预检请求: ${req.url}`);
    return res.sendStatus(200);
  }

  // 继续处理请求
  next();
}

module.exports = corsMiddleware;

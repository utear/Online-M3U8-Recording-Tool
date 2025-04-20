/**
 * CORS中间件 - 处理跨域资源共享
 * 这是一个非常直接的CORS中间件，无条件允许所有跨域请求
 */

// CORS中间件函数
function corsMiddleware(req, res, next) {
  // 获取请求的Origin
  const origin = req.headers.origin;

  // 记录请求信息，便于调试
  console.log(`[CORS] 收到请求: ${req.method} ${req.url}`);
  console.log(`[CORS] 请求来源: ${origin || '未提供'}`);
  console.log(`[CORS] 请求头部:`, req.headers);

  // 直接设置Access-Control-Allow-Origin头部
  // 如果有Origin头部，则使用该值，否则使用*
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  console.log(`[CORS] 设置Access-Control-Allow-Origin: ${origin || '*'}`);

  // 设置其他CORS头部
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24小时内不再发送预检请求
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // 如果是OPTIONS请求，直接返回200
  if (req.method === 'OPTIONS') {
    console.log('[CORS] 响应OPTIONS预检请求');
    return res.status(200).end();
  }

  // 继续处理请求
  next();
}

module.exports = corsMiddleware;

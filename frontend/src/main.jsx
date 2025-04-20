import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

/**
 * 配置axios全局设置
 * 简化版配置，专注于解决CORS问题
 */

// 获取API基础URL
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
// console.log('使用API基础URL:', apiBaseUrl);

// 设置全局默认值
axios.defaults.baseURL = apiBaseUrl;
axios.defaults.timeout = 15000; // 15秒超时，增加超时时间以应对网络延迟

// 设置默认头部
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// 添加请求拦截器
axios.interceptors.request.use(config => {
  // console.log('发送请求:', config.method?.toUpperCase(), config.url);

  // 如果有token，添加到请求头部
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
}, error => {
  console.error('请求拦截器错误:', error);
  return Promise.reject(error);
});

// 添加响应拦截器
axios.interceptors.response.use(
  response => {
    // console.log('请求成功:', response.status, response.config.url);
    return response;
  },
  error => {
    if (error.response) {
      // 服务器响应了错误状态码
      console.error('请求失败:', error.response.status, error.response.config?.url);
      // console.error('错误数据:', error.response.data);
    } else if (error.request) {
      // 请求发送了但没有收到响应
      console.error('服务器无响应:', error.config?.url);
    } else {
      // 请求配置错误
      console.error('请求配置错误:', error.message);
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

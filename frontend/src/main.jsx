import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// 创建axios实例并配置默认值
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
console.log('使用API基础URL:', apiBaseUrl);

// 创建自定义axios实例
const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // 允许跨域请求携带认证信息
  timeout: 10000, // 10秒超时
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// 设置全局默认值
axios.defaults.baseURL = apiBaseUrl;
axios.defaults.withCredentials = true;
axios.defaults.timeout = 10000;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// 添加请求拦截器
axios.interceptors.request.use(config => {
  console.log('发送请求:', config.method.toUpperCase(), config.url);

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
    console.log('收到响应:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('API请求错误:', error);
    if (error.response) {
      console.error('HTTP状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
      console.error('响应头部:', error.response.headers);
    } else if (error.request) {
      console.error('请求已发送但未收到响应:', error.request);
    } else {
      console.error('请求配置错误:', error.message);
    }
    return Promise.reject(error);
  }
);

// 将自定义实例导出供组件使用
window.axiosInstance = axiosInstance; // 全局可用作为备用

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

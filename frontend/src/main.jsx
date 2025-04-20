import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// 配置axios默认值
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL
axios.defaults.withCredentials = true // 允许跨域请求携带认证信息

// 添加请求拦截器
axios.interceptors.request.use(config => {
  // 添加请求头部
  config.headers['Accept'] = 'application/json'
  config.headers['Content-Type'] = 'application/json'

  // 如果有token，添加到请求头部
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }

  return config
}, error => {
  return Promise.reject(error)
})

// 添加响应拦截器
axios.interceptors.response.use(
  response => response,
  error => {
    console.error('API请求错误:', error)
    if (error.response) {
      console.error('HTTP状态码:', error.response.status)
      console.error('响应数据:', error.response.data)
      console.error('响应头部:', error.response.headers)
    } else if (error.request) {
      console.error('请求已发送但未收到响应:', error.request)
    } else {
      console.error('请求配置错误:', error.message)
    }
    return Promise.reject(error)
  }
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

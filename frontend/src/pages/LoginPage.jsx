import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title } = Typography;

const LoginPage = () => {
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      console.log('开始发送登录请求，数据:', values);

      // 获取API基础URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const fullUrl = `${apiBaseUrl}/api/auth/login`;
      console.log('使用完整URL进行请求:', fullUrl);

      // 尝试使用axios进行请求
      try {
        console.log('尝试使用axios进行登录...');
        // 创建一个新的axios实例，专门用于这个请求
        const axiosInstance = axios.create({
          baseURL: apiBaseUrl,
          withCredentials: true,
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });

        const response = await axiosInstance.post('/api/auth/login', values);
        console.log('使用axios登录成功:', response.data);

        const { data } = response;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        message.success('登录成功');
        navigate('/');
        return; // 成功则直接返回
      } catch (axiosError) {
        console.error('axios登录失败:', axiosError);
        console.log('尝试使用fetch API作为备用方案...');
      }

      // 如果axios失败，尝试使用fetch API
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(values),
        credentials: 'include', // 包含cookie
        mode: 'cors' // 明确指定使用CORS模式
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('登录响应:', data);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      console.error('登录错误:', error);
      message.error(`登录失败: ${error.message}`);

      // 尝试直接使用XMLHttpRequest作为最后的备用方案
      try {
        console.log('尝试使用XMLHttpRequest进行登录...');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        const fullUrl = `${apiBaseUrl}/api/auth/login`;

        // 创建一个新的Promise来处理XMLHttpRequest
        const xhrPromise = new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', fullUrl, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.withCredentials = true;

          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(`XHR Error: ${xhr.status} ${xhr.statusText}`));
            }
          };

          xhr.onerror = function() {
            reject(new Error('XHR Network Error'));
          };

          xhr.send(JSON.stringify(values));
        });

        const data = await xhrPromise;
        console.log('XHR登录成功:', data);

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        message.success('登录成功');
        navigate('/');
      } catch (xhrError) {
        console.error('XHR登录失败:', xhrError);
        message.error('所有登录方式均失败，请检查网络或联系管理员');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      console.log('开始发送注册请求，数据:', values);

      // 获取API基础URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const fullUrl = `${apiBaseUrl}/api/auth/register`;
      console.log('使用完整URL进行请求:', fullUrl);

      // 尝试使用axios进行请求
      try {
        console.log('尝试使用axios进行注册...');
        // 创建一个新的axios实例，专门用于这个请求
        const axiosInstance = axios.create({
          baseURL: apiBaseUrl,
          withCredentials: true,
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });

        const response = await axiosInstance.post('/api/auth/register', values);
        console.log('使用axios注册成功:', response.data);
        message.success('注册成功，请登录');
        registerForm.resetFields();
        return; // 成功则直接返回
      } catch (axiosError) {
        console.error('axios注册失败:', axiosError);
        console.log('尝试使用fetch API作为备用方案...');
      }

      // 如果axios失败，尝试使用fetch API
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(values),
        credentials: 'include', // 包含cookie
        mode: 'cors' // 明确指定使用CORS模式
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      console.log('注册响应:', response);
      message.success('注册成功，请登录');
      registerForm.resetFields();
    } catch (error) {
      console.error('注册错误:', error);
      message.error(`注册失败: ${error.message}`);

      // 尝试直接使用XMLHttpRequest作为最后的备用方案
      try {
        console.log('尝试使用XMLHttpRequest进行注册...');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        const fullUrl = `${apiBaseUrl}/api/auth/register`;

        // 创建一个新的Promise来处理XMLHttpRequest
        const xhrPromise = new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', fullUrl, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.withCredentials = true;

          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
            } else {
              reject(new Error(`XHR Error: ${xhr.status} ${xhr.statusText}`));
            }
          };

          xhr.onerror = function() {
            reject(new Error('XHR Network Error'));
          };

          xhr.send(JSON.stringify(values));
        });

        await xhrPromise;
        console.log('XHR注册成功');
        message.success('注册成功，请登录');
        registerForm.resetFields();
      } catch (xhrError) {
        console.error('XHR注册失败:', xhrError);
        message.error('所有注册方式均失败，请检查网络或联系管理员');
      }
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: 'login',
      label: '登录',
      children: (
        <Form
          form={loginForm}
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: '注册',
      children: (
        <Form
          form={registerForm}
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名 (3-20个字符)"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码 (至少6个字符)"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f0f2f5'
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>M3U/M3U8/视频流录制系统</Title>
          <Title level={4} style={{ color: '#666', fontWeight: 'normal' }}>用户登录</Title>
        </div>
        <Tabs
          centered
          items={items}
          size="large"
        />
      </Card>
    </div>
  );
};

export default LoginPage;

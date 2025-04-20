import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Tabs, Alert, Modal } from 'antd';
import { UserOutlined, LockOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title } = Typography;

const LoginPage = () => {
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [loginError, setLoginError] = useState(null);

  /**
   * 处理登录请求
   * @param {Object} values - 表单数据，包听username和password
   */
  const handleLogin = async (values) => {
    setLoading(true);
    try {
      // console.log('开始发送登录请求');

      // 获取API基础URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

      // 使用axios发送请求
      const response = await axios.post(`${apiBaseUrl}/api/auth/login`, values, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // console.log('登录成功:', response.data);

      // 保存用户信息和token
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // 设置全局请求头部
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      message.success('登录成功');
      navigate('/');
    } catch (error) {
      // console.error('登录失败:', error);

      // 显示错误消息
      if (error.response) {
        // 服务器响应了错误状态码
        const errorMsg = error.response.data?.message || '登录失败';
        const status = error.response.data?.status;

        // 如果是待审核、被拒绝或被禁用的状态，设置登录错误状态
        if (status === 'pending' || status === 'rejected' || error.response.data?.enabled === false) {
          setLoginError({
            message: errorMsg,
            status: status || 'disabled',
            enabled: error.response.data?.enabled
          });
        } else {
          message.error(errorMsg);
        }
      } else if (error.request) {
        // 请求发送了但没有收到响应
        message.error('服务器无响应，请检查网络连接');
      } else {
        // 请求设置时出现错误
        message.error(`登录错误: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理注册请求
   * @param {Object} values - 表单数据，包听username和password
   */
  const handleRegister = async (values) => {
    setLoading(true);
    try {
      // console.log('开始发送注册请求');

      // 获取API基础URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

      // 使用axios发送请求
      const response = await axios.post(`${apiBaseUrl}/api/auth/register`, values, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // console.log('注册成功:', response.data);
      setRegisterSuccess(true);
      registerForm.resetFields();

      // 显示注册成功弹窗
      Modal.success({
        title: '注册成功',
        content: '您的账号已成功注册，需要等待管理员审核后才能登录。',
        okText: '我知道了'
      });
    } catch (error) {
      // console.error('注册失败:', error);

      // 显示错误消息
      if (error.response) {
        // 服务器响应了错误状态码
        const errorMsg = error.response.data?.message || '注册失败';
        message.error(errorMsg);
      } else if (error.request) {
        // 请求发送了但没有收到响应
        message.error('服务器无响应，请检查网络连接');
      } else {
        // 请求设置时出现错误
        message.error(`注册错误: ${error.message}`);
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

          {loginError && (
            <Form.Item>
              <Alert
                message={
                  loginError.status === 'pending' ? '账号待审核' :
                  loginError.status === 'rejected' ? '账号已被拒绝' :
                  '账号已被禁用'
                }
                description={loginError.message}
                type={
                  loginError.status === 'pending' ? 'info' :
                  'error'
                }
                showIcon
                icon={<InfoCircleOutlined />}
              />
            </Form.Item>
          )}

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

          {registerSuccess && (
            <Form.Item>
              <Alert
                message="注册成功，等待审核"
                description="您的账号已成功注册，需要等待管理员审核后才能登录。"
                type="success"
                showIcon
              />
            </Form.Item>
          )}

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

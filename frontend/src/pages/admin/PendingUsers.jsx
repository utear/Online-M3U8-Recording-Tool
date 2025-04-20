import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  message,
  Card,
  Spin,
  Tag,
  Popconfirm
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const PendingUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 获取待审核用户列表
  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/pending-users');
      setUsers(response.data);
    } catch (error) {
      message.error('获取待审核用户列表失败');
      console.error('获取待审核用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchPendingUsers();
  }, []);

  // 批准用户
  const handleApprove = async (username) => {
    try {
      await axios.post('/api/auth/approve-user', {
        username,
        approved: true
      });
      message.success(`用户 ${username} 已批准`);
      fetchPendingUsers();
    } catch (error) {
      message.error('批准用户失败');
      console.error('批准用户失败:', error);
    }
  };

  // 拒绝用户
  const handleReject = async (username) => {
    try {
      await axios.post('/api/auth/approve-user', {
        username,
        approved: false
      });
      message.success(`用户 ${username} 已拒绝`);
      fetchPendingUsers();
    } catch (error) {
      message.error('拒绝用户失败');
      console.error('拒绝用户失败:', error);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        let color = role === 'admin' ? 'red' : 'green';
        return (
          <Tag color={color}>
            {role === 'admin' ? '管理员' : '普通用户'}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: () => (
        <Tag color="blue">待审核</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Popconfirm
            title="确定要批准此用户吗？"
            onConfirm={() => handleApprove(record.username)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'green' }} />}
          >
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              size="small"
            >
              批准
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要拒绝此用户吗？"
            onConfirm={() => handleReject(record.username)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="primary"
              danger
              icon={<CloseCircleOutlined />}
              size="small"
            >
              拒绝
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="待审核用户">
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            onClick={fetchPendingUsers}
          >
            刷新列表
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无待审核用户' }}
        />
      </Spin>
    </Card>
  );
};

export default PendingUsers;

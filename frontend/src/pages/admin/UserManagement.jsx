import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Card,
  Spin
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
  LockOutlined,
  UnlockOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('添加用户');
  const [form] = Form.useForm();
  const [editingUserId, setEditingUserId] = useState(null);

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/users');
      setUsers(response.data);
    } catch (error) {
      message.error('获取用户列表失败');
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchUsers();
  }, []);

  // 打开添加用户模态框
  const showAddModal = () => {
    setModalTitle('添加用户');
    setEditingUserId(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑用户模态框
  const showEditModal = (user) => {
    setModalTitle('编辑用户');
    setEditingUserId(user.username);
    form.setFieldsValue({
      username: user.username,
      role: user.role,
      password: '' // 不回显密码
    });
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingUserId) {
        // 编辑用户
        await axios.put(`/api/users/${editingUserId}`, {
          role: values.role,
          ...(values.password ? { password: values.password } : {})
        });
        message.success('用户更新成功');
      } else {
        // 添加用户
        await axios.post('/api/users', values);
        message.success('用户添加成功');
      }

      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.response?.data?.message || '操作失败');
      console.error('操作失败:', error);
    }
  };

  // 删除用户
  const handleDelete = async (username) => {
    try {
      await axios.delete(`/api/users/${username}`);
      message.success('用户删除成功');
      fetchUsers();
    } catch (error) {
      message.error('删除用户失败');
      console.error('删除用户失败:', error);
    }
  };

  // 启用/禁用用户
  const handleToggleEnabled = async (username, enabled) => {
    try {
      await axios.post('/api/auth/toggle-user', { username, enabled });
      message.success(`用户 ${username} 已${enabled ? '启用' : '禁用'}`);
      fetchUsers();
    } catch (error) {
      message.error(`${enabled ? '启用' : '禁用'}用户失败`);
      console.error(`${enabled ? '启用' : '禁用'}用户失败:`, error);
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
      render: (status, record) => {
        let color = 'default';
        let text = '未知';
        let icon = null;

        if (status === 'pending') {
          color = 'blue';
          text = '待审核';
          icon = <ClockCircleOutlined />;
        } else if (status === 'rejected') {
          color = 'red';
          text = '已拒绝';
          icon = <StopOutlined />;
        } else if (status === 'approved') {
          if (record.enabled === 0) {
            color = 'orange';
            text = '已禁用';
            icon = <LockOutlined />;
          } else {
            color = 'green';
            text = '正常';
            icon = <CheckCircleOutlined />;
          }
        }

        return (
          <Tag color={color} icon={icon}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => {
        return enabled === 0 ?
          <Tag color="red" icon={<LockOutlined />}>禁用</Tag> :
          <Tag color="green" icon={<UnlockOutlined />}>启用</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => showEditModal(record)}
          >
            编辑
          </Button>

          {record.enabled === 1 ? (
            <Popconfirm
              title="确定要禁用此用户吗？"
              onConfirm={() => handleToggleEnabled(record.username, false)}
              okText="确定"
              cancelText="取消"
              icon={<ExclamationCircleOutlined style={{ color: 'orange' }} />}
            >
              <Button
                type="primary"
                danger
                icon={<LockOutlined />}
                size="small"
              >
                禁用
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              icon={<UnlockOutlined />}
              size="small"
              onClick={() => handleToggleEnabled(record.username, true)}
            >
              启用
            </Button>
          )}

          <Popconfirm
            title="确定要删除此用户吗？"
            onConfirm={() => handleDelete(record.username)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="用户管理">
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showAddModal}
          >
            添加用户
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />

        <Modal
          title={modalTitle}
          open={modalVisible}
          onOk={handleSubmit}
          onCancel={handleCancel}
          okText="确定"
          cancelText="取消"
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' }
              ]}
              disabled={!!editingUserId}
            >
              <Input placeholder="请输入用户名" disabled={!!editingUserId} />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: !editingUserId, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
              tooltip={editingUserId ? "留空表示不修改密码" : ""}
            >
              <Input.Password placeholder={editingUserId ? "留空表示不修改密码" : "请输入密码"} />
            </Form.Item>

            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
              initialValue="user"
            >
              <Select placeholder="请选择角色">
                <Option value="user">普通用户</Option>
                <Option value="admin">管理员</Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </Spin>
    </Card>
  );
};

export default UserManagement;

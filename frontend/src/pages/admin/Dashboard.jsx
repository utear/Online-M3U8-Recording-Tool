import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Table, Tag, Button, message, Spin } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  CloudDownloadOutlined,
  SettingOutlined,
  LogoutOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  HomeOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import UserManagement from './UserManagement';
import TaskManagement from './TaskManagement';
import SystemSettings from './SystemSettings';
import FileManagement from './FileManagement';
import PendingUsers from './PendingUsers';

const { Header, Sider, Content } = Layout;

const Dashboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState('1');
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    activeDownloads: 0,
    completedTasks: 0,
    storageUsed: '0 GB'
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/stats');
      setStatistics(response.data);
    } catch (error) {
      message.error('获取统计数据失败');
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // 获取最近任务
  const fetchRecentTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/recent-tasks');

      // 处理任务数据
      const tasksWithFormattedSize = await Promise.all(response.data.map(async (task) => {
        let fileSize = task.fileSize;

        // 如果任务正在运行，获取实时文件大小
        if (task.status === 'running' || task.status === 'downloading') {
          try {
            const sizeResponse = await axios.get(`/api/tasks/${task.id}/file-size`);
            fileSize = sizeResponse.data.fileSize;
          } catch (error) {
            console.error(`获取任务 ${task.id} 的文件大小失败:`, error);
          }
        }

        return {
          key: task.id,
          id: task.id,
          name: task.url.split('/').pop() || task.url,
          status: task.status,
          user: task.username,
          createdAt: new Date(task.createdAt).toLocaleString(),
          fileSize: formatFileSize(fileSize)
        };
      }));

      setRecentTasks(tasksWithFormattedSize);
    } catch (error) {
      message.error('获取最近任务失败');
      console.error('获取最近任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载数据和自动刷新设置
  useEffect(() => {
    // 初始加载数据
    fetchStatistics();
    fetchRecentTasks();

    // 设置定时刷新，每10秒自动刷新一次
    const refreshInterval = setInterval(() => {
      console.log('自动刷新仪表盘数据...');
      fetchStatistics();
      fetchRecentTasks();
    }, 10000);

    // 组件卸载时清除定时器
    return () => clearInterval(refreshInterval);
  }, []);

  // 刷新数据
  const handleRefresh = () => {
    fetchStatistics();
    fetchRecentTasks();
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        let text = status;

        switch(status) {
          case 'recording':
          case 'running':
            color = 'processing';
            text = '下载中';
            break;
          case 'completed':
            color = 'success';
            text = '已完成';
            break;
          case 'error':
            color = 'error';
            text = '错误';
            break;
          case 'stopped':
            color = 'warning';
            text = '已停止';
            break;
          default:
            color = 'default';
        }

        return (
          <Tag color={color}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
    },
  ];

  // 处理菜单点击
  const handleMenuClick = (key) => {
    setActiveKey(key);

    // 这里可以根据不同的菜单项加载不同的内容
    // 目前只实现了仪表盘，其他功能可以在后续开发
  };

  // 处理登出
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo" style={{ height: 32, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', color: '#fff' }}>
            <VideoCameraOutlined style={{ fontSize: '24px', marginRight: collapsed ? '0' : '8px' }} />
            {!collapsed && <span style={{ fontSize: '16px', fontWeight: 'bold' }}>直播录制工具</span>}
          </a>
        </div>
        <Menu
          theme="dark"
          defaultSelectedKeys={['1']}
          selectedKeys={[activeKey]}
          mode="inline"
          items={[
            {
              key: '1',
              icon: <DashboardOutlined />,
              label: '仪表盘',
              onClick: () => handleMenuClick('1'),
            },
            {
              key: '2',
              icon: <UserOutlined />,
              label: '用户管理',
              onClick: () => handleMenuClick('2'),
            },
            {
              key: '7',
              icon: <UserOutlined />,
              label: '待审核用户',
              onClick: () => handleMenuClick('7'),
            },
            {
              key: '3',
              icon: <CloudDownloadOutlined />,
              label: '任务管理',
              onClick: () => handleMenuClick('3'),
            },
            {
              key: '4',
              icon: <FolderOutlined />,
              label: '文件管理',
              onClick: () => handleMenuClick('4'),
            },
            {
              key: '5',
              icon: <SettingOutlined />,
              label: '系统设置',
              onClick: () => handleMenuClick('5'),
            },
            {
              key: '6',
              icon: <LogoutOutlined />,
              label: '退出登录',
              onClick: handleLogout,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', marginRight: 16, color: '#1890ff' }}>
              <HomeOutlined style={{ fontSize: 16, marginRight: 8 }} />
              <span>返回首页</span>
            </a>
            <span style={{ fontSize: 18, fontWeight: 'bold' }}>管理员仪表盘</span>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            style={{ marginRight: 16 }}
            loading={loading}
          >
            刷新数据
          </Button>
        </Header>
        <Content style={{ margin: '16px' }}>
          <Spin spinning={loading}>
          {activeKey === '1' && (
            <>
              <Row gutter={16}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="总用户数"
                      value={statistics.totalUsers}
                      prefix={<UserOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="活跃下载"
                      value={statistics.activeDownloads}
                      prefix={<CloudDownloadOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="已完成任务"
                      value={statistics.completedTasks}
                      prefix={<DashboardOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="存储使用"
                      value={statistics.storageUsed}
                      prefix={<CloudDownloadOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              <Card
                style={{ marginTop: 16 }}
                title="最近任务"
                extra={<span style={{ fontSize: 12, color: '#999' }}>每10秒自动刷新</span>}
              >
                <Table
                  columns={columns}
                  dataSource={recentTasks}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </>
          )}

          {activeKey === '2' && <UserManagement />}

          {activeKey === '3' && <TaskManagement />}

          {activeKey === '4' && <FileManagement />}

          {activeKey === '5' && <SystemSettings />}

          {activeKey === '7' && <PendingUsers />}
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;

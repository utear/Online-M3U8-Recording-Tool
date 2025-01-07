import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Table, Tag } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  CloudDownloadOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const Dashboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  // 示例数据
  const statistics = {
    totalUsers: 125,
    activeDownloads: 8,
    completedTasks: 1234,
    storageUsed: '128GB'
  };

  const recentTasks = [
    {
      key: '1',
      name: 'example.m3u8',
      status: 'downloading',
      progress: '45%',
      speed: '2.5MB/s'
    },
    // 更多任务...
  ];

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'downloading' ? 'processing' : 'success'}>
          {status === 'downloading' ? '下载中' : '已完成'}
        </Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
    },
    {
      title: '速度',
      dataIndex: 'speed',
      key: 'speed',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo" style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu
          theme="dark"
          defaultSelectedKeys={['1']}
          mode="inline"
          items={[
            {
              key: '1',
              icon: <DashboardOutlined />,
              label: '仪表盘',
            },
            {
              key: '2',
              icon: <UserOutlined />,
              label: '用户管理',
            },
            {
              key: '3',
              icon: <CloudDownloadOutlined />,
              label: '任务管理',
            },
            {
              key: '4',
              icon: <SettingOutlined />,
              label: '系统设置',
            },
            {
              key: '5',
              icon: <LogoutOutlined />,
              label: '退出登录',
              onClick: () => {
                // 处理登出逻辑
                localStorage.removeItem('token');
                navigate('/login');
              },
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff' }} />
        <Content style={{ margin: '16px' }}>
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
          
          <Card style={{ marginTop: 16 }} title="最近任务">
            <Table columns={columns} dataSource={recentTasks} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;

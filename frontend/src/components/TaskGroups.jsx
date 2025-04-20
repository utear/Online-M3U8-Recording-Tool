import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  message,
  Collapse,
  List,
  Typography,
  Modal,
  Empty
} from 'antd';
import {
  StopOutlined,
  DownOutlined,
  UpOutlined,
  PlayCircleOutlined,
  DesktopOutlined,
  HistoryOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Panel } = Collapse;
const { Title, Text } = Typography;

// 从环境变量获取API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const TaskGroups = ({ fetchTasks, openConsole, viewHistory, handleDownload, getStatusTag }) => {
  const [taskGroups, setTaskGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groupDetails, setGroupDetails] = useState({});

  // 获取任务组列表
  const fetchTaskGroups = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/batch`);
      setTaskGroups(response.data);
    } catch (error) {
      console.error('获取任务组失败:', error);
      message.error('获取任务组失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取任务组详情
  const fetchGroupDetails = async (groupId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/batch/${groupId}`);
      setGroupDetails(prev => ({
        ...prev,
        [groupId]: response.data
      }));
    } catch (error) {
      console.error(`获取任务组 ${groupId} 详情失败:`, error);
      message.error(`获取任务组详情失败`);
    }
  };

  // 停止任务组
  const handleStopGroup = async (groupId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/batch/${groupId}/stop`);
      message.success('已停止任务组中的所有任务');
      fetchTaskGroups();
      fetchTasks();
    } catch (error) {
      console.error('停止任务组失败:', error);
      message.error('停止任务组失败');
    }
  };

  // 删除任务组
  const handleDeleteGroup = async (groupId) => {
    try {
      Modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        content: '确定要删除此任务组及其所有任务吗？此操作不可撤销。',
        okText: '确定删除',
        okType: 'danger',
        okButtonProps: {
          danger: true,
          type: 'primary',
          style: { backgroundColor: '#ff4d4f', borderColor: '#ff4d4f' }
        },
        cancelText: '取消',
        onOk: async () => {
          const response = await axios.delete(`${API_BASE_URL}/api/batch/${groupId}`);
          message.success('任务组已删除');
          fetchTaskGroups();
          fetchTasks();
        },
        onCancel: () => {
          // 用户取消删除操作
          message.info('已取消删除操作');
        }
      });
    } catch (error) {
      console.error('删除任务组失败:', error);
      message.error('删除任务组失败');
    }
  };

  // 处理折叠面板展开/收起
  const handleCollapseChange = (keys) => {
    setExpandedGroups(keys);
    
    // 当展开一个组时，获取其详情
    keys.forEach(groupId => {
      if (!groupDetails[groupId]) {
        fetchGroupDetails(groupId);
      }
    });
  };

  // 初始加载
  useEffect(() => {
    fetchTaskGroups();
    
    // 定期刷新任务组列表
    const interval = setInterval(fetchTaskGroups, 10000);
    return () => clearInterval(interval);
  }, []);

  // 获取任务组状态标签
  const getGroupStatusTag = (group) => {
    const status = group.status;
    
    if (status === 'failed') {
      return <Tag color="error">失败</Tag>;
    }
    if (status === 'completed') {
      return <Tag color="success">已完成</Tag>;
    }
    if (status === 'stopped') {
      return <Tag color="warning">已停止</Tag>;
    }
    
    // 其他状态显示为"进行中"
    return <Tag color="processing">进行中</Tag>;
  };

  // 渲染任务组列表
  return (
    <Card 
      title="批量任务组" 
      style={{ marginTop: '24px' }}
      extra={
        <Button type="primary" onClick={fetchTaskGroups} loading={loading}>
          刷新
        </Button>
      }
    >
      {taskGroups.length > 0 ? (
        <Collapse 
          onChange={handleCollapseChange}
          expandIconPosition="start"
          expandIcon={({ isActive }) => isActive ? <UpOutlined /> : <DownOutlined />}
        >
          {taskGroups.map(group => (
            <Panel 
              key={group.id}
              header={
                <Space>
                  <span>{group.name}</span>
                  {getGroupStatusTag(group)}
                  <Text type="secondary">任务数: {group.taskCount}</Text>
                  <Text type="secondary">创建时间: {new Date(group.createdAt).toLocaleString()}</Text>
                </Space>
              }
              extra={
                <Space>
                  <Button 
                    type="link" 
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(group.id);
                    }}
                  >
                    删除任务组
                  </Button>
                  <Button 
                    type="primary" 
                    danger 
                    icon={<StopOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStopGroup(group.id);
                    }}
                    disabled={group.status === 'completed' || group.status === 'stopped'}
                  >
                    停止所有
                  </Button>
                </Space>
              }
            >
              {groupDetails[group.id] ? (
                <List
                  dataSource={groupDetails[group.id].tasks}
                  renderItem={task => (
                    <List.Item
                      key={task.id}
                      actions={[
                        <Button
                          key="console"
                          icon={<DesktopOutlined />}
                          onClick={() => openConsole(task.id)}
                        >
                          控制台
                        </Button>,
                        <Button
                          key="history"
                          icon={<HistoryOutlined />}
                          onClick={() => viewHistory(task.id)}
                        >
                          历史
                        </Button>,
                        task.status === 'completed' || task.status === 'paused' ? (
                          <Button
                            key="download"
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload(task)}
                          >
                            下载
                          </Button>
                        ) : null
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        title={<a href={task.url} target="_blank" rel="noopener noreferrer">{task.url}</a>}
                        description={`ID: ${task.id} | 创建时间: ${new Date(task.createdAt).toLocaleString()}`}
                      />
                      {getStatusTag(task.status)}
                    </List.Item>
                  )}
                />
              ) : (
                <div>加载任务组详情...</div>
              )}
            </Panel>
          ))}
        </Collapse>
      ) : (
        <Empty description="暂无任务组" />
      )}
    </Card>
  );
};

export default TaskGroups;
import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Tag,
  message,
  Popconfirm,
  Modal,
  Input,
  Spin,
  Tooltip,
  Badge,
  Drawer,
  Typography
} from 'antd';
import {
  DeleteOutlined,
  StopOutlined,
  EyeOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

const TaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 获取所有任务
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tasks/all');
      setTasks(response.data);
    } catch (error) {
      message.error('获取任务列表失败');
      console.error('获取任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和自动刷新设置
  useEffect(() => {
    // 初始加载数据
    fetchTasks();

    // 设置定时刷新，每10秒自动刷新一次
    const refreshInterval = setInterval(() => {
      console.log('自动刷新任务列表...');
      fetchTasks();
    }, 10000);

    // 组件卸载时清除定时器
    return () => clearInterval(refreshInterval);
  }, []);

  // 停止任务
  const handleStopTask = async (taskId) => {
    try {
      await axios.post(`/api/tasks/${taskId}/stop`);
      message.success('任务已停止');
      fetchTasks();
    } catch (error) {
      message.error('停止任务失败');
      console.error('停止任务失败:', error);
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      message.success('任务已删除');
      fetchTasks();
    } catch (error) {
      message.error('删除任务失败');
      console.error('删除任务失败:', error);
    }
  };

  // 下载文件
  const handleDownload = async (task) => {
    if (!task.outputFile) {
      message.error('没有可下载的文件');
      return;
    }

    try {
      message.loading({ content: '准备下载...', key: 'download' });

      // 获取下载链接
      const response = await axios.get(`/api/tasks/${task.id}/download-url`);
      const downloadUrl = response.data.url;

      // 使用浏览器原生下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success({ content: '下载已开始', key: 'download', duration: 2 });
    } catch (error) {
      message.error({ content: '下载失败', key: 'download' });
      console.error('下载失败:', error);
    }
  };

  // 查看任务历史
  const handleViewHistory = async (task) => {
    setSelectedTask(task);
    setDrawerVisible(true);

    try {
      setHistoryLoading(true);
      const response = await axios.get(`/api/tasks/${task.id}/history`);
      setTaskHistory(response.data);
    } catch (error) {
      message.error('获取任务历史失败');
      console.error('获取任务历史失败:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 过滤任务
  const filteredTasks = tasks.filter(task => {
    return (
      task.url.toLowerCase().includes(searchText.toLowerCase()) ||
      task.username.toLowerCase().includes(searchText.toLowerCase()) ||
      task.status.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
          <Badge status={
            color === 'processing' ? 'processing' :
            color === 'success' ? 'success' :
            color === 'error' ? 'error' :
            color === 'warning' ? 'warning' : 'default'
          }>
            <Tag color={color}>
              {text}
            </Tag>
          </Badge>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (fileSize) => {
        if (!fileSize) return '-';
        const size = fileSize / (1024 * 1024);
        return `${size.toFixed(2)} MB`;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            详情
          </Button>

          {['recording', 'running'].includes(record.status) && (
            <Popconfirm
              title="确定要停止此任务吗？"
              onConfirm={() => handleStopTask(record.id)}
              okText="确定"
              cancelText="取消"
              icon={<ExclamationCircleOutlined style={{ color: 'orange' }} />}
            >
              <Button
                type="primary"
                danger
                size="small"
                icon={<StopOutlined />}
              >
                停止
              </Button>
            </Popconfirm>
          )}

          {record.outputFile && (
            <Button
              type="primary"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}

          <Popconfirm
            title="确定要删除此任务吗？"
            onConfirm={() => handleDeleteTask(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="primary"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="任务管理"
      extra={<span style={{ fontSize: 12, color: '#999' }}>每10秒自动刷新</span>}
    >
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchTasks}
            >
              刷新
            </Button>
          </Space>

          <Input
            placeholder="搜索任务"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
            allowClear
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />

        <Drawer
          title={`任务详情 - ${selectedTask?.url}`}
          placement="right"
          width={600}
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
        >
          {selectedTask && (
            <Spin spinning={historyLoading}>
              <div style={{ marginBottom: 16 }}>
                <p><Text strong>任务ID:</Text> {selectedTask.id}</p>
                <p><Text strong>用户:</Text> {selectedTask.username}</p>
                <p><Text strong>URL:</Text> {selectedTask.url}</p>
                <p><Text strong>状态:</Text> {selectedTask.status}</p>
                <p><Text strong>创建时间:</Text> {new Date(selectedTask.createdAt).toLocaleString()}</p>
                <p><Text strong>输出文件:</Text> {selectedTask.outputFile || '无'}</p>
                <p><Text strong>文件大小:</Text> {selectedTask.fileSize ? `${(selectedTask.fileSize / (1024 * 1024)).toFixed(2)} MB` : '无'}</p>
              </div>

              <Card title="任务历史记录" style={{ marginTop: 16 }}>
                {taskHistory.length > 0 ? (
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    {taskHistory.map((item, index) => (
                      <div key={index} style={{ marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                        <p><Text type="secondary">{new Date(item.timestamp).toLocaleString()}</Text></p>
                        <p>{item.output}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Text type="secondary">暂无历史记录</Text>
                  </div>
                )}
              </Card>
            </Spin>
          )}
        </Drawer>
      </Spin>
    </Card>
  );
};

export default TaskManagement;

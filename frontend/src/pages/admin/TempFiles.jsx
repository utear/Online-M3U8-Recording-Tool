import React, { useState } from 'react';
import { Table, Button, Space, Popconfirm, Input, Typography, Tag, Tooltip, Modal } from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined, FileOutlined, FolderOutlined, ExclamationCircleOutlined, ClearOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const TempFiles = ({ files, totalSize, onDelete, onClean, onRefresh }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [taskInfoVisible, setTaskInfoVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // 处理批量删除
  const handleBatchDelete = async () => {
    try {
      // 获取选中的文件夹路径
      const selectedPaths = selectedRowKeys.map(key => {
        const file = files.find(f => f.path === key);
        return file ? file.path : null;
      }).filter(Boolean);

      // 逐个删除文件夹
      for (const path of selectedPaths) {
        await onDelete(path);
      }

      // 清空选择
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('批量删除文件夹失败:', error);
    }
  };

  // 显示任务信息
  const showTaskInfo = (record) => {
    setCurrentTask(record);
    setTaskInfoVisible(true);
  };

  // 获取任务状态标签
  const getStatusTag = (status) => {
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

    return <Tag color={color}>{text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.isDirectory ? <FolderOutlined /> : <FileOutlined />}
          <Tooltip title={record.path}>
            <span>{text}</span>
          </Tooltip>
          {record.taskId && (
            <Button
              type="link"
              icon={<InfoCircleOutlined />}
              size="small"
              onClick={() => showTaskInfo(record)}
            />
          )}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => formatFileSize(size),
      sorter: (a, b) => a.size - b.size,
    },
    {
      title: '关联任务',
      dataIndex: 'taskId',
      key: 'taskId',
      render: (taskId, record) => taskId ? (
        <Space>
          <span>#{taskId}</span>
          {record.taskStatus && getStatusTag(record.taskStatus)}
        </Space>
      ) : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Popconfirm
            title={record.taskId && record.taskStatus === 'running' ?
              "此文件夹关联正在运行的任务，确定要删除吗？" :
              "确定要删除此文件夹吗？"}
            onConfirm={() => onDelete(record.path)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
              disabled={record.taskId && record.taskStatus === 'running'}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: record.taskId && record.taskStatus === 'running', // 禁止选择正在运行的任务
    }),
  };

  // 处理搜索
  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  // 过滤只显示目录
  const directoriesOnly = files.filter(file => file.isDirectory);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
          >
            刷新
          </Button>
          <Popconfirm
            title="确定要删除选中的文件夹吗？"
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要清理所有非活跃任务的临时文件吗？"
            onConfirm={onClean}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="primary"
              danger
              icon={<ClearOutlined />}
            >
              清理所有临时文件
            </Button>
          </Popconfirm>
        </Space>

        <Space>
          <Tag color="blue">总存储使用: {totalSize}</Tag>
          <Input
            placeholder="搜索文件夹名"
            value={searchText}
            onChange={handleSearch}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Space>
      </div>

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={directoriesOnly}
        rowKey="path"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有临时文件夹' }}
      />

      {/* 任务信息弹窗 */}
      <Modal
        title="关联任务信息"
        open={taskInfoVisible}
        onCancel={() => setTaskInfoVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTaskInfoVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {currentTask && (
          <div>
            <p><strong>任务ID:</strong> {currentTask.taskId}</p>
            <p><strong>状态:</strong> {getStatusTag(currentTask.taskStatus)}</p>
            <p><strong>URL:</strong> {currentTask.taskUrl}</p>
            <p><strong>创建时间:</strong> {dayjs(currentTask.taskCreatedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TempFiles;

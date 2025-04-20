import React, { useState } from 'react';
import { Table, Button, Space, Popconfirm, Input, Typography, Tag, Tooltip } from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined, FileOutlined, FolderOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DownloadFiles = ({ files, totalSize, onDelete, onRefresh }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');

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
      // 获取选中的文件路径
      const selectedPaths = selectedRowKeys.map(key => {
        const file = files.find(f => f.path === key);
        return file ? file.path : null;
      }).filter(Boolean);

      // 逐个删除文件
      for (const path of selectedPaths) {
        await onDelete(path);
      }

      // 清空选择
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('批量删除文件失败:', error);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.isDirectory ? <FolderOutlined /> : <FileOutlined />}
          <Tooltip title={record.path}>
            <span>{text}</span>
          </Tooltip>
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
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedAt',
      key: 'modifiedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.modifiedAt) - new Date(b.modifiedAt),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Popconfirm
            title="确定要删除此文件吗？"
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
  };

  // 处理搜索
  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

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
            title="确定要删除选中的文件吗？"
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
        </Space>

        <Space>
          <Tag color="blue">总存储使用: {totalSize}</Tag>
          <Input
            placeholder="搜索文件名"
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
        dataSource={files}
        rowKey="path"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有文件' }}
      />
    </div>
  );
};

export default DownloadFiles;

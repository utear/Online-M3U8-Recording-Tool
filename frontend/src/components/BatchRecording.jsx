import React, { useState, useCallback, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  message,
  Space,
  Collapse,
  Tooltip,
  Tag,
  Table,
  Modal,
  Typography,
  Switch,
  Select,
  InputNumber
} from 'antd';
import {
  PlayCircleOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  FileAddOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text } = Typography;

// 从环境变量获取API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const BatchRecording = ({ RECORDING_OPTIONS, fetchTasks }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 处理URL输入变化
  const handleUrlsChange = (e) => {
    const inputText = e.target.value;
    const urlList = inputText.split('\n').filter(url => url.trim() !== '');
    setUrls(urlList);

    // 将值设置到表单中，确保表单状态与组件状态一致
    form.setFieldsValue({ urls: inputText });
  };

  // 监听表单初始值变化
  useEffect(() => {
    const initialUrls = form.getFieldValue('urls');
    if (initialUrls) {
      const urlList = initialUrls.split('\n').filter(url => url.trim() !== '');
      setUrls(urlList);
    }
    
    // 添加表单值变化监听器
    const unsubscribe = form.getFieldInstance('urls')?.addEventListener('change', (e) => {
      if (e.target.value) {
        const urlList = e.target.value.split('\n').filter(url => url.trim() !== '');
        setUrls(urlList);
      }
    });

    // 创建表单值同步定时器，确保表单值不会丢失
    const intervalId = setInterval(() => {
      const formUrls = form.getFieldValue('urls');
      if (formUrls) {
        // 如果表单有值但组件状态无值，则同步到组件状态
        if (formUrls.trim() && urls.length === 0) {
          const urlList = formUrls.split('\n').filter(url => url.trim() !== '');
          setUrls(urlList);
        }
      }
    }, 500); // 每500ms检查一次

    // 监听App.jsx中的batchUrlsUpdated事件
    const handleBatchUrlsUpdated = (event) => {
      if (event.detail && event.detail.urls) {
        const urlList = event.detail.urls.split('\n').filter(url => url.trim() !== '');
        setUrls(urlList);
        // 确保表单值也被更新
        form.setFieldsValue({ urls: event.detail.urls });
        console.log('批量URL已更新:', urlList.length, '个URL');
      }
    };
    
    window.addEventListener('batchUrlsUpdated', handleBatchUrlsUpdated);

    return () => {
      // 清理监听器和定时器
      if (unsubscribe) unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener('batchUrlsUpdated', handleBatchUrlsUpdated);
    };
  }, [form, urls]);

  // 预览批量任务
  const showPreview = () => {
    // 获取表单中的实际URL
    const formUrlsValue = form.getFieldValue('urls');
    const actualUrls = formUrlsValue ? formUrlsValue.split('\n').filter(url => url.trim() !== '') : [];
    
    // 如果状态和表单不同步，先更新状态
    if (actualUrls.length > 0 && urls.length === 0) {
      setUrls(actualUrls);
    }
    
    if (actualUrls.length === 0) {
      message.warning('请至少输入一个URL');
      return;
    }
    
    setPreviewVisible(true);
  };

  // 开始批量录制
  const handleStartBatchRecording = async () => {
    // 获取表单中的实际URL
    const formUrlsValue = form.getFieldValue('urls');
    const actualUrls = formUrlsValue ? formUrlsValue.split('\n').filter(url => url.trim() !== '') : [];
    
    // 如果状态和表单不同步，先更新状态
    if (actualUrls.length > 0 && urls.length === 0) {
      setUrls(actualUrls);
    }
    
    if (actualUrls.length === 0) {
      message.warning('请至少输入一个URL');
      return;
    }

    // 从表单中获取值
    const values = form.getFieldsValue();

    try {
      setLoading(true);
      const options = {};

      // 处理所有配置项
      Object.keys(RECORDING_OPTIONS).forEach(category => {
        if (RECORDING_OPTIONS[category]) {
          RECORDING_OPTIONS[category].forEach(option => {
            if (values[option.name] !== undefined && values[option.name] !== '') {
              if (option.type === 'datetime' && values[option.name]) {
                // 确保日期时间值被正确格式化
                options[option.name] = dayjs(values[option.name]).format('YYYYMMDDHHmmss');
              } else if (option.type === 'switch') {
                // 开关类型的值处理
                options[option.name] = values[option.name];
              } else if (option.type === 'select') {
                // 选择器类型的值处理
                options[option.name] = values[option.name];
              } else if (option.type === 'number') {
                // 数字类型的值处理
                options[option.name] = Number(values[option.name]);
              } else {
                // 其他类型的值处理
                options[option.name] = values[option.name];
              }
            }
          });
        }
      });

      console.log('批量录制参数:', options);

      const response = await axios.post(`${API_BASE_URL}/api/batch/start`, {
        urls: actualUrls, // 使用从表单获取的actualUrls
        groupName: values.groupName || `批量任务-${new Date().toLocaleString()}`,
        options
      });

      message.success(`成功创建${response.data.taskCount}个录制任务`);
      form.resetFields();
      setUrls([]);
      setPreviewVisible(false);
      fetchTasks(); // 刷新任务列表
    } catch (error) {
      message.error('批量录制失败');
      console.error('批量录制失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 预览表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 80,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            const newUrls = [...urls];
            newUrls.splice(record.index - 1, 1);
            setUrls(newUrls);
            form.setFieldsValue({
              urls: newUrls.join('\n')
            });
          }}
        />
      ),
    },
  ];

  // 预览数据
  const previewData = urls.map((url, index) => ({
    key: index,
    index: index + 1,
    url
  }));

  return (
    <div>
        <Form.Item
          name="urls"
          label={
            <Tooltip title="每行一个URL，支持m3u/m3u8/视频流地址">
              <Space>
                批量视频流地址
                <QuestionCircleOutlined />
              </Space>
            </Tooltip>
          }
          rules={[{ required: true, message: '请输入视频流地址' }]}
          className="url-input"
        >
          <TextArea
            placeholder="请输入视频流地址，每行一个"
            autoSize={{ minRows: 4, maxRows: 10 }}
            onChange={handleUrlsChange}
          />
        </Form.Item>

        <Form.Item
          name="groupName"
          label="任务组名称"
          rules={[{ required: false }]}
        >
          <Input placeholder="为此批量任务组命名，默认使用时间戳" />
        </Form.Item>

        <Collapse
          ghost
          className="settings-collapse"
          defaultActiveKey={['basic']}
          items={Object.keys(RECORDING_OPTIONS).map(category => ({
            key: category,
            label: {
              'basic': '基础设置',
              'download': '下载设置',
              'live': '直播设置',
              'processing': '处理设置',
              'subtitle': '字幕设置',
              'system': '系统设置',
              'encryption': '加密设置',
              'selection': '流选择设置'
            }[category] || category,
            children: (
              <div className="options-container">
                {RECORDING_OPTIONS[category] && RECORDING_OPTIONS[category].map(option => (
                  <Form.Item
                    key={option.name}
                    name={option.name}
                    label={
                      <Tooltip title={option.tooltip}>
                        <Space>
                          {option.label}
                          <QuestionCircleOutlined />
                        </Space>
                      </Tooltip>
                    }
                    initialValue={option.defaultValue}
                    valuePropName={option.valuePropName || 'value'}
                  >
                    {option.type === 'input' ? (
                      <Input placeholder={option.placeholder} />
                    ) : option.type === 'number' ? (
                      <Input type="number" placeholder={option.placeholder} min={option.min} />
                    ) : option.type === 'datetime' ? (
                      <Input type="datetime-local" />
                    ) : option.type === 'switch' ? (
                      <Switch defaultChecked={option.defaultValue} />
                    ) : option.type === 'select' ? (
                      <Select placeholder={option.placeholder}>
                        {option.options && option.options.map(value => (
                          <Select.Option key={value} value={value.toString()}>{value}</Select.Option>
                        ))}
                      </Select>
                    ) : null}
                  </Form.Item>
                ))}
              </div>
            )
          }))}
        />

        <Form.Item className="submit-button">
          <Space>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={showPreview}
              size="large"
              disabled={urls.length === 0 && !form.getFieldValue('urls')}
            >
              预览任务
            </Button>
            <Button
              type="primary"
              onClick={handleStartBatchRecording}
              loading={loading}
              icon={<PlayCircleOutlined />}
              size="large"
              disabled={urls.length === 0 && !form.getFieldValue('urls')}
            >
              开始批量录制
            </Button>
          </Space>
        </Form.Item>

      <Modal
        title="批量录制任务预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="back" onClick={() => setPreviewVisible(false)}>
            返回编辑
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleStartBatchRecording}
          >
            开始录制
          </Button>,
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>共 <Tag color="blue">{urls.length}</Tag> 个录制任务</Text>
            <Table
              columns={columns}
              dataSource={previewData}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default BatchRecording;

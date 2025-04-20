import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  message,
  Tabs,
  Space,
  Spin,
  Divider,
  Typography,
  Alert,
  InputNumber,
  Select,
  Table,
  Tag,
  Tooltip,
  Modal
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const SystemSettings = () => {
  const [loading, setLoading] = useState(false);
  const [iptvLoading, setIptvLoading] = useState(false);
  const [settings, setSettings] = useState({
    iptvSources: [
      {
        name: '默认IPTV源',
        url: 'https://github.com/vbskycn/iptv/blob/master/tv/iptv4.m3u',
        enabled: true
      }
    ],
    iptvUpdateInterval: 4,
    useProxy: false,
    proxyHost: '127.0.0.1',
    proxyPort: 7890,
    downloadPath: './downloads',
    tempPath: './temp',
    maxConcurrentTasks: 5,
    logLevel: 'INFO'
  });

  // IPTV源编辑相关状态
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [sourceForm] = Form.useForm();

  const [form] = Form.useForm();

  // 获取系统设置
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/settings');
      setSettings(response.data);
      form.setFieldsValue(response.data);
    } catch (error) {
      message.error('获取系统设置失败');
      console.error('获取系统设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchSettings();
  }, []);

  // 保存系统设置
  const handleSaveSettings = async (values) => {
    try {
      setLoading(true);
      await axios.post('/api/settings', values);
      message.success('系统设置已保存');
      fetchSettings();
    } catch (error) {
      message.error('保存系统设置失败');
      console.error('保存系统设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 手动更新IPTV列表
  const handleUpdateIPTV = async () => {
    try {
      setIptvLoading(true);
      await axios.post('/api/iptv/update');
      message.success('IPTV列表更新成功');
    } catch (error) {
      message.error('更新IPTV列表失败');
      console.error('更新IPTV列表失败:', error);
    } finally {
      setIptvLoading(false);
    }
  };

  // 打开添加IPTV源对话框
  const handleAddSource = () => {
    setEditingSource(null);
    sourceForm.resetFields();
    sourceForm.setFieldsValue({
      name: '',
      url: '',
      enabled: true
    });
    setSourceModalVisible(true);
  };

  // 打开编辑IPTV源对话框
  const handleEditSource = (source) => {
    setEditingSource(source);
    sourceForm.setFieldsValue({
      name: source.name,
      url: source.url,
      enabled: source.enabled !== false // 默认为true
    });
    setSourceModalVisible(true);
  };

  // 删除IPTV源
  const handleDeleteSource = (sourceIndex) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个IPTV源吗？删除后需要点击保存设置才会生效。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newSources = [...settings.iptvSources];
        newSources.splice(sourceIndex, 1);
        setSettings({
          ...settings,
          iptvSources: newSources
        });
        form.setFieldsValue({
          ...settings,
          iptvSources: newSources
        });
        message.success('IPTV源已删除，请点击保存设置以生效');
      }
    });
  };

  // 切换IPTV源启用状态
  const handleToggleSourceStatus = (sourceIndex) => {
    const newSources = [...settings.iptvSources];
    newSources[sourceIndex].enabled = !newSources[sourceIndex].enabled;
    setSettings({
      ...settings,
      iptvSources: newSources
    });
    form.setFieldsValue({
      ...settings,
      iptvSources: newSources
    });
  };

  // 保存IPTV源
  const handleSaveSource = () => {
    sourceForm.validateFields().then(values => {
      const newSources = [...settings.iptvSources];

      if (editingSource) {
        // 编辑现有源
        const index = newSources.findIndex(s => s.name === editingSource.name && s.url === editingSource.url);
        if (index !== -1) {
          newSources[index] = values;
        }
      } else {
        // 添加新源
        newSources.push(values);
      }

      setSettings({
        ...settings,
        iptvSources: newSources
      });

      form.setFieldsValue({
        ...settings,
        iptvSources: newSources
      });

      setSourceModalVisible(false);
      message.success(`IPTV源已${editingSource ? '更新' : '添加'}，请点击保存设置以生效`);
    });
  };

  return (
    <Card title="系统设置">
      <Spin spinning={loading}>
        <Tabs defaultActiveKey="1">
          <TabPane
            tab={
              <span>
                <GlobalOutlined />
                IPTV设置
              </span>
            }
            key="1"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={settings}
            >
              {/* IPTV源列表 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={4}>IPTV源管理</Title>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddSource}
                  >
                    添加IPTV源
                  </Button>
                </div>

                <Table
                  dataSource={settings.iptvSources}
                  rowKey={(record, index) => index}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '名称',
                      dataIndex: 'name',
                      key: 'name',
                      width: '20%',
                    },
                    {
                      title: '地址',
                      dataIndex: 'url',
                      key: 'url',
                      width: '50%',
                      ellipsis: true,
                      render: (text) => (
                        <Tooltip title={text}>
                          <span>{text}</span>
                        </Tooltip>
                      ),
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      key: 'enabled',
                      width: '10%',
                      render: (enabled) => (
                        <Tag color={enabled !== false ? 'success' : 'default'}>
                          {enabled !== false ? '启用' : '禁用'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: '20%',
                      render: (_, record, index) => (
                        <Space>
                          <Button
                            type="text"
                            icon={record.enabled !== false ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                            onClick={() => handleToggleSourceStatus(index)}
                            size="small"
                          >
                            {record.enabled !== false ? '禁用' : '启用'}
                          </Button>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEditSource(record)}
                            size="small"
                          >
                            编辑
                          </Button>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteSource(index)}
                            size="small"
                          >
                            删除
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>

              <Alert
                message="提示"
                description="添加多个IPTV源可以获取更多频道。系统会自动合并所有启用的源中的频道并去除重复项。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="iptvUpdateInterval"
                label="更新间隔（小时）"
                rules={[{ required: true, message: '请输入更新间隔' }]}
              >
                <InputNumber min={1} max={24} style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                name="useProxy"
                label="使用代理"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.useProxy !== currentValues.useProxy}
              >
                {({ getFieldValue }) =>
                  getFieldValue('useProxy') ? (
                    <div style={{ display: 'flex', gap: 16 }}>
                      <Form.Item
                        name="proxyHost"
                        label="代理主机"
                        rules={[{ required: true, message: '请输入代理主机' }]}
                      >
                        <Input placeholder="例如：127.0.0.1" />
                      </Form.Item>

                      <Form.Item
                        name="proxyPort"
                        label="代理端口"
                        rules={[{ required: true, message: '请输入代理端口' }]}
                      >
                        <InputNumber min={1} max={65535} style={{ width: 200 }} />
                      </Form.Item>
                    </div>
                  ) : null
                }
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                  >
                    保存设置
                  </Button>

                  <Button
                    type="default"
                    onClick={fetchSettings}
                    icon={<ReloadOutlined />}
                  >
                    重置
                  </Button>

                  <Button
                    type="primary"
                    onClick={handleUpdateIPTV}
                    loading={iptvLoading}
                    icon={<CloudSyncOutlined />}
                  >
                    立即更新IPTV列表
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            {/* IPTV源编辑对话框 */}
            <Modal
              title={editingSource ? '编辑IPTV源' : '添加IPTV源'}
              open={sourceModalVisible}
              onCancel={() => setSourceModalVisible(false)}
              footer={[
                <Button key="cancel" onClick={() => setSourceModalVisible(false)}>
                  取消
                </Button>,
                <Button key="submit" type="primary" onClick={handleSaveSource}>
                  保存
                </Button>,
              ]}
            >
              <Form
                form={sourceForm}
                layout="vertical"
              >
                <Form.Item
                  name="name"
                  label="名称"
                  rules={[{ required: true, message: '请输入IPTV源名称' }]}
                >
                  <Input placeholder="例如：中国IPTV" />
                </Form.Item>

                <Form.Item
                  name="url"
                  label="地址"
                  rules={[{ required: true, message: '请输入IPTV源地址' }]}
                >
                  <Input placeholder="请输入m3u文件地址" />
                </Form.Item>

                <Form.Item
                  name="enabled"
                  label="状态"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Form>
            </Modal>
          </TabPane>

          <TabPane
            tab={
              <span>
                <DatabaseOutlined />
                存储设置
              </span>
            }
            key="2"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={settings}
            >
              <Form.Item
                name="downloadPath"
                label="下载目录"
                rules={[{ required: true, message: '请输入下载目录' }]}
              >
                <Input placeholder="例如：./downloads" />
              </Form.Item>

              <Form.Item
                name="tempPath"
                label="临时文件目录"
                rules={[{ required: true, message: '请输入临时文件目录' }]}
              >
                <Input placeholder="例如：./temp" />
              </Form.Item>

              <Form.Item
                name="maxConcurrentTasks"
                label="最大并发任务数"
                rules={[{ required: true, message: '请输入最大并发任务数' }]}
              >
                <InputNumber min={1} max={20} style={{ width: 200 }} />
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                  >
                    保存设置
                  </Button>

                  <Button
                    type="default"
                    onClick={fetchSettings}
                    icon={<ReloadOutlined />}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane
            tab={
              <span>
                <SettingOutlined />
                系统设置
              </span>
            }
            key="3"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={settings}
            >
              <Form.Item
                name="logLevel"
                label="日志级别"
                rules={[{ required: true, message: '请选择日志级别' }]}
              >
                <Select style={{ width: 200 }}>
                  <Option value="DEBUG">DEBUG</Option>
                  <Option value="INFO">INFO</Option>
                  <Option value="WARN">WARN</Option>
                  <Option value="ERROR">ERROR</Option>
                </Select>
              </Form.Item>

              <Alert
                message="系统信息"
                description={
                  <div>
                    <p>系统版本：1.0.0</p>
                    <p>浏览器：{navigator.userAgent}</p>
                    <p>操作系统：{navigator.platform}</p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                  >
                    保存设置
                  </Button>

                  <Button
                    type="default"
                    onClick={fetchSettings}
                    icon={<ReloadOutlined />}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Spin>
    </Card>
  );
};

export default SystemSettings;

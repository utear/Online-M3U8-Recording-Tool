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
  Select
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const SystemSettings = () => {
  const [loading, setLoading] = useState(false);
  const [iptvLoading, setIptvLoading] = useState(false);
  const [settings, setSettings] = useState({
    iptvSource: 'https://github.com/vbskycn/iptv/blob/master/tv/iptv4.m3u',
    iptvUpdateInterval: 4,
    useProxy: false,
    proxyHost: '127.0.0.1',
    proxyPort: 7890,
    downloadPath: './downloads',
    tempPath: './temp',
    maxConcurrentTasks: 5,
    logLevel: 'INFO'
  });
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
              <Form.Item
                name="iptvSource"
                label="IPTV源地址"
                rules={[{ required: true, message: '请输入IPTV源地址' }]}
              >
                <Input placeholder="请输入IPTV源地址" />
              </Form.Item>

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

import React, { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, List } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

/**
 * 选择菜单弹出框组件
 * 
 * @param {boolean} visible - 是否显示弹出框
 * @param {Array} options - 选项列表，格式为 [{key: '1', label: '选项1'}, ...]
 * @param {string} prompt - 提示文本
 * @param {function} onSelect - 选择回调函数，参数为选择的值
 * @param {function} onCancel - 取消回调函数
 */
const SelectionMenuPopup = ({ visible, options, prompt, onSelect, onCancel }) => {
  const [selectedKey, setSelectedKey] = useState(null);

  // 重置选择状态
  useEffect(() => {
    if (visible) {
      setSelectedKey(null);
    }
  }, [visible]);

  // 处理选择
  const handleSelect = (key) => {
    setSelectedKey(key);
    onSelect(key);
  };

  return (
    <Modal
      title="请选择下载选项"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={500}
      centered
      maskClosable={false}
    >
      <div style={{ marginBottom: '20px' }}>
        <Title level={5} style={{ marginBottom: '16px' }}>
          {prompt || '请选择一个选项:'}
        </Title>
        <List
          bordered
          dataSource={options}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                backgroundColor: selectedKey === item.key ? '#f0f8ff' : 'transparent',
                transition: 'background-color 0.3s'
              }}
              onClick={() => handleSelect(item.key)}
            >
              <Space>
                <Text keyboard>{item.key}</Text>
                <Text>{item.label}</Text>
                {selectedKey === item.key && (
                  <CheckOutlined style={{ color: '#1890ff' }} />
                )}
              </Space>
            </List.Item>
          )}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            disabled={!selectedKey}
            onClick={() => onSelect(selectedKey)}
          >
            确认选择
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default SelectionMenuPopup;

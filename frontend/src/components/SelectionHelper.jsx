import React, { useEffect, useState } from 'react';
import { Button, Space, Typography, Card } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 选择菜单辅助组件
 *
 * @param {string} terminalOutput - 终端输出内容
 * @param {function} onSelect - 选择回调函数，参数为选择的值
 */
const SelectionHelper = ({ terminalOutput, onSelect }) => {
  const [options, setOptions] = useState([]);
  const [visible, setVisible] = useState(false);

  // 解析终端输出，识别选择菜单
  useEffect(() => {
    if (!terminalOutput) return;

    // 检测是否包含选择提示
    const selectionPrompt = terminalOutput.match(/请选择.*:|选择.*:|请输入.*:|Select.*:|Choose.*:|\[选择\]|\[Select\]|\[Choose\]/i);
    if (!selectionPrompt) {
      setVisible(false);
      return;
    }

    // 排除视频和音频流信息
    if (terminalOutput.includes('INFO : [0x1') &&
        (terminalOutput.includes('Video') || terminalOutput.includes('Audio'))) {
      setVisible(false);
      return;
    }

    // 提取选项
    const lines = terminalOutput.split('\n');
    // 更精确的选项正则表达式，避免匹配视频/音频流信息
    const optionsRegex = /^\s*\[\s*(\d+|[a-zA-Z])\s*\]\s*(.*?)(?:\s*\||$)/;
    const extractedOptions = [];

    // 查找最后一个选择提示后的选项
    let promptIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].match(/请选择.*:|选择.*:|请输入.*:|Select.*:|Choose.*:|\[选择\]|\[Select\]|\[Choose\]/i)) {
        promptIndex = i;
        break;
      }
    }

    if (promptIndex >= 0) {
      // 从提示行开始向下查找选项
      for (let i = promptIndex; i < lines.length; i++) {
        const match = lines[i].match(optionsRegex);
        if (match) {
          // 确保这不是视频/音频流信息
          if (!lines[i].includes('INFO : [0x1')) {
            extractedOptions.push({
              key: match[1],
              label: match[2].trim()
            });
          }
        }
      }
    }

    // 只有当找到至少两个选项时才显示选择框
    // 这有助于避免误判单个数字或字母为选择菜单
    if (extractedOptions.length >= 2) {
      setOptions(extractedOptions);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [terminalOutput]);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!visible) return;

      const key = e.key;
      const option = options.find(opt => opt.key === key);
      if (option) {
        onSelect(option.key);
        setVisible(false); // 选择后隐藏选择框
        e.preventDefault(); // 防止键盘输入到终端输入框
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, options, onSelect]);

  if (!visible) return null;

  return (
    <Card
      title="检测到选择菜单"
      size="small"
      style={{
        marginBottom: '10px',
        backgroundColor: '#f0f8ff',
        borderLeft: '4px solid #1890ff'
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>按下对应的键盘按键快速选择:</Text>
        <Space wrap>
          {options.map(option => (
            <Button
              key={option.key}
              type="default"
              onClick={() => {
                onSelect(option.key);
                setVisible(false); // 选择后隐藏选择框
              }}
              style={{ margin: '2px' }}
            >
              <Text keyboard>{option.key}</Text> <ArrowRightOutlined /> {option.label}
            </Button>
          ))}
        </Space>
      </Space>
    </Card>
  );
};

export default SelectionHelper;

import React, { useState, useEffect, useMemo } from 'react';
import { Input, List, Button, Space, message, Select, Spin, Radio, Modal, Checkbox, Tag, Tooltip } from 'antd';
import { SearchOutlined, PlayCircleOutlined, AppstoreAddOutlined, FilterOutlined } from '@ant-design/icons';
import VirtualList from 'rc-virtual-list';
import axios from 'axios';

const { Option } = Select;
const PAGE_SIZE = 50;
const CONTAINER_HEIGHT = 600;

const IPTVPage = ({ form }) => {
  const [channels, setChannels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [page, setPage] = useState(1);
  const [recordMode, setRecordMode] = useState('single'); // 'single' 或 'batch'
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [batchSearchText, setBatchSearchText] = useState('');

  // 使用useMemo缓存分组列表
  const groups = useMemo(() => {
    const groupSet = new Set(channels.map(channel => channel.group));
    return ['all', ...Array.from(groupSet)];
  }, [channels]);

  // 使用useMemo缓存源列表
  const sources = useMemo(() => {
    const sourceSet = new Set(channels.filter(channel => channel.source).map(channel => channel.source));
    return ['all', ...Array.from(sourceSet)];
  }, [channels]);

  // 使用useMemo缓存过滤后的频道列表
  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const matchesSearch = searchText === '' ||
        channel.name.toLowerCase().includes(searchText.toLowerCase()) ||
        channel.group.toLowerCase().includes(searchText.toLowerCase()) ||
        (channel.source && channel.source.toLowerCase().includes(searchText.toLowerCase()));

      const matchesGroup = selectedGroup === 'all' || channel.group === selectedGroup;

      const matchesSource = selectedSource === 'all' ||
        (channel.source && channel.source === selectedSource);

      return matchesSearch && matchesGroup && matchesSource;
    });
  }, [channels, searchText, selectedGroup, selectedSource]);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/iptv/channels')
      .then(response => {
        setChannels(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching channels:', error);
        message.error('加载频道列表失败');
        setLoading(false);
      });
  }, []);

  const handleSearch = (value) => {
    setSearchText(value);
    setPage(1);
  };

  const handleGroupChange = (value) => {
    setSelectedGroup(value);
    setPage(1);
  };

  const handleSourceChange = (value) => {
    setSelectedSource(value);
    setPage(1);
  };

  const handleSelectChannel = (url) => {
    if (recordMode === 'single') {
      if (form) {
        form.setFieldsValue({ url });
        message.success('已填入播放地址');
      } else {
        message.error('无法找到视频流地址输入框');
      }
    } else {
      // 批量模式下打开选择对话框
      setBatchSearchText(''); // 重置搜索文本
      setBatchModalVisible(true);
    }
  };

  // 切换录制模式
  const handleModeChange = (e) => {
    setRecordMode(e.target.value);
    // 切换模式时清空选中的频道
    setSelectedChannels([]);
    setSelectAll(false);
  };

  // 切换频道选中状态
  const toggleChannelSelection = (channel) => {
    setSelectedChannels(prev => {
      const isSelected = prev.some(c => c.url === channel.url);
      if (isSelected) {
        return prev.filter(c => c.url !== channel.url);
      } else {
        return [...prev, channel];
      }
    });
  };

  // 全选/取消全选
  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    setSelectAll(checked);

    // 获取当前过滤后的频道
    const currentFilteredChannels = filteredChannels.filter(channel =>
      batchSearchText ?
        channel.name.toLowerCase().includes(batchSearchText.toLowerCase()) ||
        channel.group.toLowerCase().includes(batchSearchText.toLowerCase())
      : true
    );

    if (checked) {
      // 如果已经有选中的频道，则合并当前选中的和新过滤的
      const existingSelected = selectedChannels.filter(selected =>
        !currentFilteredChannels.some(filtered => filtered.url === selected.url)
      );
      setSelectedChannels([...existingSelected, ...currentFilteredChannels]);
    } else {
      // 取消选中当前过滤的频道，保留其他选中的
      setSelectedChannels(selectedChannels.filter(selected =>
        !currentFilteredChannels.some(filtered => filtered.url === selected.url)
      ));
    }
  };

  // 确认批量选择
  const handleBatchConfirm = () => {
    if (selectedChannels.length === 0) {
      message.warning('请至少选择一个频道');
      return;
    }

    if (form) {
      // 将选中的URL填入到批量录制表单中
      const urls = selectedChannels.map(channel => channel.url).join('\n');

      // 切换到录制页面并选择批量录制选项卡
      window.dispatchEvent(new CustomEvent('switchToBatchRecording', {
        detail: { urls }
      }));

      message.success(`已选择${selectedChannels.length}个频道进行批量录制`);
      setBatchModalVisible(false);
    } else {
      message.error('无法找到批量录制表单');
    }
  };

  const onScroll = (e) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
    // 当距离底部小于 50px 时触发加载
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setPage(prev => prev + 1);
    }
  };

  const displayChannels = filteredChannels.slice(0, page * PAGE_SIZE);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: '#f5222d', marginBottom: '20px' }}>IPTV直播频道列表</h2>

      <Space style={{ marginBottom: '20px' }} size="large" wrap>
        <Input
          placeholder="输入频道名称搜索..."
          prefix={<SearchOutlined style={{ color: '#f5222d' }} />}
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '300px',
            borderColor: '#f5222d',
          }}
        />

        <Select
          value={selectedGroup}
          onChange={handleGroupChange}
          style={{ width: '180px' }}
          placeholder="选择频道分组"
        >
          {groups.map(group => (
            <Option key={group} value={group}>
              {group === 'all' ? '全部分组' : group}
            </Option>
          ))}
        </Select>

        {sources.length > 1 && (
          <Select
            value={selectedSource}
            onChange={handleSourceChange}
            style={{ width: '180px' }}
            placeholder="选择IPTV源"
          >
            {sources.map(source => (
              <Option key={source} value={source}>
                {source === 'all' ? '全部源' : source}
              </Option>
            ))}
          </Select>
        )}

        <Radio.Group
          value={recordMode}
          onChange={handleModeChange}
          buttonStyle="solid"
          style={{ marginLeft: '20px' }}
        >
          <Radio.Button value="single">
            <PlayCircleOutlined /> 单个录制
          </Radio.Button>
          <Radio.Button value="batch">
            <AppstoreAddOutlined /> 批量录制
          </Radio.Button>
        </Radio.Group>
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '10px', color: '#8c8c8c' }}>
            共找到 {filteredChannels.length} 个频道
          </div>

          <List>
            <VirtualList
              data={displayChannels}
              height={CONTAINER_HEIGHT}
              itemHeight={70}
              itemKey="url"
              onScroll={onScroll}
            >
              {(channel) => (
                <List.Item
                  key={channel.url}
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleSelectChannel(channel.url)}
                      style={{ color: '#f5222d' }}
                    >
                      播放地址
                    </Button>
                  ]}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    padding: '12px 0'
                  }}
                >
                  <List.Item.Meta
                    title={
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ color: '#262626', fontWeight: 'bold', marginRight: '8px' }}>{channel.name}</span>
                          <span style={{ color: '#8c8c8c', fontSize: '12px', marginRight: '8px' }}>({channel.group})</span>
                          {channel.source && (
                            <Tag color="blue" style={{ fontSize: '11px' }}>
                              来源: {channel.source}
                            </Tag>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', wordBreak: 'break-all' }}>
                          <Tooltip title={channel.url}>
                            <span>地址: {channel.url.length > 60 ? `${channel.url.substring(0, 60)}...` : channel.url}</span>
                          </Tooltip>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            </VirtualList>
          </List>
        </>
      )}

      {/* 批量选择对话框 */}
      <Modal
        title="选择要批量录制的频道"
        open={batchModalVisible}
        onOk={handleBatchConfirm}
        onCancel={() => setBatchModalVisible(false)}
        width={800}
        okText="确认选择"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <Checkbox
                checked={(() => {
                  // 当前过滤后的频道
                  const currentFilteredChannels = filteredChannels.filter(channel =>
                    batchSearchText ?
                      channel.name.toLowerCase().includes(batchSearchText.toLowerCase()) ||
                      channel.group.toLowerCase().includes(batchSearchText.toLowerCase())
                    : true
                  );
                  // 如果当前过滤后的频道为空，则不勾选
                  return currentFilteredChannels.length > 0 &&
                    currentFilteredChannels.every(channel =>
                      selectedChannels.some(selected => selected.url === channel.url)
                    );
                })()}
                onChange={handleSelectAllChange}
                style={{ marginRight: '8px' }}
              >
                全选
              </Checkbox>
              <span style={{ marginLeft: '16px' }}>
                已选择 <span style={{ color: '#f5222d', fontWeight: 'bold' }}>{selectedChannels.length}</span> 个频道
              </span>
            </div>
            <Input.Search
              placeholder="搜索频道名称"
              style={{ width: 200 }}
              allowClear
              value={batchSearchText}
              onChange={(e) => setBatchSearchText(e.target.value)}
              onSearch={(value) => setBatchSearchText(value)}
            />
          </div>
        </div>

        <List
          dataSource={filteredChannels.filter(channel =>
            batchSearchText ?
              channel.name.toLowerCase().includes(batchSearchText.toLowerCase()) ||
              channel.group.toLowerCase().includes(batchSearchText.toLowerCase())
            : true
          )}
          renderItem={channel => (
            <List.Item
              key={channel.url}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedChannels.some(c => c.url === channel.url) ? '#f6f6f6' : 'transparent',
                padding: '8px 16px',
                borderRadius: '4px',
                marginBottom: '4px'
              }}
              onClick={() => toggleChannelSelection(channel)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={selectedChannels.some(c => c.url === channel.url)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleChannelSelection(channel);
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>{channel.name}</span>
                  <span style={{ color: '#888', marginLeft: '8px' }}>{channel.group}</span>
                  {channel.source && (
                    <Tag color="blue" style={{ fontSize: '11px', marginLeft: '8px' }}>
                      来源: {channel.source}
                    </Tag>
                  )}
                </div>
                <div style={{ marginLeft: '24px', color: '#666', fontSize: '11px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 'bold' }}>地址:</span> {channel.url}
                </div>
              </div>
            </List.Item>
          )}
          style={{ maxHeight: '400px', overflow: 'auto' }}
        />
      </Modal>
    </div>
  );
};

export default IPTVPage;

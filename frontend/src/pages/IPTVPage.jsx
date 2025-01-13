import React, { useState, useEffect, useMemo } from 'react';
import { Input, List, Button, Space, message, Select, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import VirtualList from 'rc-virtual-list';

const { Option } = Select;
const PAGE_SIZE = 50;
const CONTAINER_HEIGHT = 600;

const IPTVPage = ({ form }) => {
  const [channels, setChannels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [page, setPage] = useState(1);

  // 使用useMemo缓存分组列表
  const groups = useMemo(() => {
    const groupSet = new Set(channels.map(channel => channel.group));
    return ['all', ...Array.from(groupSet)];
  }, [channels]);

  // 使用useMemo缓存过滤后的频道列表
  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const matchesSearch = searchText === '' || 
        channel.name.toLowerCase().includes(searchText.toLowerCase()) ||
        channel.group.toLowerCase().includes(searchText.toLowerCase());
      
      const matchesGroup = selectedGroup === 'all' || channel.group === selectedGroup;
      
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchText, selectedGroup]);

  useEffect(() => {
    setLoading(true);
    fetch('https://raw.githubusercontent.com/vbskycn/iptv/refs/heads/master/tv/iptv4.m3u')
      .then(response => response.text())
      .then(data => {
        const lines = data.split('\n');
        const parsedChannels = [];
        
        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].startsWith('#EXTINF')) {
            const info = lines[i];
            const url = lines[i + 1];
            
            const nameMatch = info.match(/tvg-name="([^"]+)"/);
            const groupMatch = info.match(/group-title="([^"]+)"/);
            const titleMatch = info.match(/,\s*(.+)$/);

            if (nameMatch && url) {
              parsedChannels.push({
                name: nameMatch[1],
                group: groupMatch ? groupMatch[1] : '未分组',
                title: titleMatch ? titleMatch[1] : nameMatch[1],
                url: url.trim()
              });
            }
          }
        }
        
        setChannels(parsedChannels);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching IPTV list:', error);
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

  const handleSelectChannel = (url) => {
    if (form) {
      form.setFieldsValue({ url });
      message.success('已填入播放地址');
    } else {
      message.error('无法找到视频流地址输入框');
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
      
      <Space style={{ marginBottom: '20px' }} size="large">
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
          style={{ width: '200px' }}
          placeholder="选择频道分组"
        >
          {groups.map(group => (
            <Option key={group} value={group}>
              {group === 'all' ? '全部分组' : group}
            </Option>
          ))}
        </Select>
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
              itemHeight={47}
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
                      <Space>
                        <span style={{ color: '#262626' }}>{channel.name}</span>
                        <span style={{ color: '#8c8c8c', fontSize: '12px' }}>({channel.group})</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            </VirtualList>
          </List>
        </>
      )}
    </div>
  );
};

export default IPTVPage;

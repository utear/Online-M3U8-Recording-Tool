import React, { useState, useEffect } from 'react';
import { Input, List, Button, Space, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const IPTVPage = ({ form }) => {
  const [channels, setChannels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filteredChannels, setFilteredChannels] = useState([]);

  useEffect(() => {
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
                group: groupMatch ? groupMatch[1] : '',
                title: titleMatch ? titleMatch[1] : nameMatch[1],
                url: url.trim()
              });
            }
          }
        }
        
        setChannels(parsedChannels);
        setFilteredChannels(parsedChannels);
      })
      .catch(error => console.error('Error fetching IPTV list:', error));
  }, []);

  const handleSearch = (value) => {
    setSearchText(value);
    const filtered = channels.filter(channel => 
      channel.name.toLowerCase().includes(value.toLowerCase()) ||
      channel.group.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredChannels(filtered);
  };

  const handleSelectChannel = (url) => {
    if (form) {
      form.setFieldsValue({
        url: url
      });
      message.success('已填入播放地址');
    } else {
      message.error('无法找到视频流地址输入框');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: '#f5222d', marginBottom: '20px' }}>IPTV直播频道列表</h2>
      <Input
        placeholder="输入频道名称搜索..."
        prefix={<SearchOutlined style={{ color: '#f5222d' }} />}
        value={searchText}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ 
          marginBottom: '20px', 
          maxWidth: '400px',
          borderColor: '#f5222d',
        }}
      />
      
      <List
        dataSource={filteredChannels}
        renderItem={channel => (
          <List.Item
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
        style={{ 
          background: '#fff',
          padding: '24px',
          borderRadius: '8px',
          maxHeight: '600px',
          overflowY: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      />
    </div>
  );
};

export default IPTVPage;

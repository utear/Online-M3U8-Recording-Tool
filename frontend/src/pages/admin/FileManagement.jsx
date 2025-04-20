import React, { useState, useEffect } from 'react';
import { Tabs, Card, Spin, message } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';
import DownloadFiles from './DownloadFiles';
import TempFiles from './TempFiles';
import axios from 'axios';

const { TabPane } = Tabs;

const FileManagement = () => {
  const [loading, setLoading] = useState(false);
  const [downloadFiles, setDownloadFiles] = useState([]);
  const [tempFiles, setTempFiles] = useState([]);
  const [downloadTotalSize, setDownloadTotalSize] = useState('0 B');
  const [tempTotalSize, setTempTotalSize] = useState('0 B');
  const [activeKey, setActiveKey] = useState('1');

  // 获取下载文件列表
  const fetchDownloadFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/download-files');
      setDownloadFiles(response.data.files);
      setDownloadTotalSize(response.data.totalSizeFormatted);
    } catch (error) {
      message.error('获取下载文件列表失败');
      console.error('获取下载文件列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取临时文件列表
  const fetchTempFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/temp-files');
      setTempFiles(response.data.files);
      setTempTotalSize(response.data.totalSizeFormatted);
    } catch (error) {
      message.error('获取临时文件列表失败');
      console.error('获取临时文件列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除下载文件
  const handleDeleteDownloadFile = async (filePath) => {
    try {
      setLoading(true);
      await axios.delete('/api/dashboard/download-file', { data: { filePath } });
      message.success('文件已成功删除');
      fetchDownloadFiles();
    } catch (error) {
      message.error('删除文件失败');
      console.error('删除文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除临时文件夹
  const handleDeleteTempFolder = async (folderPath) => {
    try {
      setLoading(true);
      await axios.delete('/api/dashboard/temp-folder', { data: { folderPath } });
      message.success('文件夹已成功删除');
      fetchTempFiles();
    } catch (error) {
      message.error('删除文件夹失败');
      console.error('删除文件夹失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 清理所有临时文件
  const handleCleanTemp = async () => {
    try {
      setLoading(true);
      const response = await axios.delete('/api/dashboard/clean-temp');
      message.success(response.data.message);
      fetchTempFiles();
    } catch (error) {
      message.error('清理临时文件失败');
      console.error('清理临时文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (activeKey === '1') {
      fetchDownloadFiles();
    } else if (activeKey === '2') {
      fetchTempFiles();
    }
  }, [activeKey]);

  // 处理标签页切换
  const handleTabChange = (key) => {
    setActiveKey(key);
  };

  return (
    <Card title="文件管理">
      <Spin spinning={loading}>
        <Tabs activeKey={activeKey} onChange={handleTabChange}>
          <TabPane
            tab={
              <span>
                <FileOutlined />
                下载文件
              </span>
            }
            key="1"
          >
            <DownloadFiles
              files={downloadFiles}
              totalSize={downloadTotalSize}
              onDelete={handleDeleteDownloadFile}
              onRefresh={fetchDownloadFiles}
            />
          </TabPane>
          <TabPane
            tab={
              <span>
                <FolderOutlined />
                临时文件
              </span>
            }
            key="2"
          >
            <TempFiles
              files={tempFiles}
              totalSize={tempTotalSize}
              onDelete={handleDeleteTempFolder}
              onClean={handleCleanTemp}
              onRefresh={fetchTempFiles}
            />
          </TabPane>
        </Tabs>
      </Spin>
    </Card>
  );
};

export default FileManagement;

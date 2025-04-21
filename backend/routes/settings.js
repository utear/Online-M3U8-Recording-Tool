const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_FILE_PATH = path.join(__dirname, '..', 'data', 'config.json');

// 默认配置
const DEFAULT_CONFIG = {
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
};

// 确保配置文件存在
const ensureConfigFile = () => {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      // 确保目录存在
      const configDir = path.dirname(CONFIG_FILE_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 写入默认配置
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
  } catch (error) {
    console.error('确保配置文件存在失败:', error);
  }
};

// 读取配置
const readConfig = () => {
  try {
    ensureConfigFile();
    const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('读取配置失败:', error);
    return DEFAULT_CONFIG;
  }
};

// 写入配置
const writeConfig = (config) => {
  try {
    ensureConfigFile();
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('写入配置失败:', error);
    return false;
  }
};

// 获取系统设置
router.get('/', (req, res) => {
  try {
    console.log('[SETTINGS] 收到获取系统设置请求');
    console.log('[SETTINGS] 请求用户:', req.user ? req.user.username : '未认证');
    console.log('[SETTINGS] 请求头部:', req.headers);

    const config = readConfig();
    console.log('[SETTINGS] 返回系统设置成功');
    res.json(config);
  } catch (error) {
    console.error('[SETTINGS] 获取系统设置失败:', error);
    res.status(500).json({ message: '获取系统设置失败' });
  }
});

// 更新系统设置
router.post('/', (req, res) => {
  try {
    console.log('[SETTINGS] 收到更新系统设置请求');
    console.log('[SETTINGS] 请求用户:', req.user ? req.user.username : '未认证');
    console.log('[SETTINGS] 请求头部:', req.headers);

    const newConfig = req.body;
    console.log('[SETTINGS] 请求数据:', JSON.stringify(newConfig, null, 2));

    // 验证必填字段
    if (!newConfig.iptvSources) {
      console.error('[SETTINGS] 验证失败: iptvSources字段缺失');
      return res.status(400).json({ message: '缺少IPTV源字段' });
    }

    if (!Array.isArray(newConfig.iptvSources)) {
      console.error('[SETTINGS] 验证失败: iptvSources不是数组');
      return res.status(400).json({ message: 'IPTV源必须是数组格式' });
    }

    if (!newConfig.downloadPath) {
      console.error('[SETTINGS] 验证失败: downloadPath字段缺失');
      return res.status(400).json({ message: '缺少下载目录字段' });
    }

    if (!newConfig.tempPath) {
      console.error('[SETTINGS] 验证失败: tempPath字段缺失');
      return res.status(400).json({ message: '缺少临时文件目录字段' });
    }

    // 验证IPTV源格式
    for (const source of newConfig.iptvSources) {
      if (!source.name || !source.url) {
        console.error('[SETTINGS] 验证失败: IPTV源格式不正确', source);
        return res.status(400).json({ message: 'IPTV源格式不正确，需要名称和地址' });
      }
    }

    // 合并配置
    const currentConfig = readConfig();
    const mergedConfig = { ...currentConfig, ...newConfig };

    // 兼容旧版本配置，如果有iptvSource字段则删除
    if (mergedConfig.iptvSource) {
      console.log('[SETTINGS] 删除旧版本iptvSource字段');
      delete mergedConfig.iptvSource;
    }

    // 写入配置
    if (writeConfig(mergedConfig)) {
      console.log('[SETTINGS] 系统设置更新成功');
      res.json({ message: '系统设置已更新', config: mergedConfig });
    } else {
      console.error('[SETTINGS] 写入配置文件失败');
      res.status(500).json({ message: '更新系统设置失败' });
    }
  } catch (error) {
    console.error('[SETTINGS] 更新系统设置失败:', error);
    res.status(500).json({ message: '更新系统设置失败', error: error.message });
  }
});

module.exports = router;

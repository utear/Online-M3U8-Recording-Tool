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
    const config = readConfig();
    res.json(config);
  } catch (error) {
    console.error('获取系统设置失败:', error);
    res.status(500).json({ message: '获取系统设置失败' });
  }
});

// 更新系统设置
router.post('/', (req, res) => {
  try {
    const newConfig = req.body;

    // 验证必填字段
    if (!newConfig.iptvSources || !Array.isArray(newConfig.iptvSources) ||
        !newConfig.downloadPath || !newConfig.tempPath) {
      return res.status(400).json({ message: '缺少必填字段' });
    }

    // 验证IPTV源格式
    for (const source of newConfig.iptvSources) {
      if (!source.name || !source.url) {
        return res.status(400).json({ message: 'IPTV源格式不正确，需要名称和地址' });
      }
    }

    // 合并配置
    const currentConfig = readConfig();
    const mergedConfig = { ...currentConfig, ...newConfig };

    // 兼容旧版本配置，如果有iptvSource字段则删除
    if (mergedConfig.iptvSource) {
      delete mergedConfig.iptvSource;
    }

    // 写入配置
    if (writeConfig(mergedConfig)) {
      res.json({ message: '系统设置已更新', config: mergedConfig });
    } else {
      res.status(500).json({ message: '更新系统设置失败' });
    }
  } catch (error) {
    console.error('更新系统设置失败:', error);
    res.status(500).json({ message: '更新系统设置失败' });
  }
});

module.exports = router;

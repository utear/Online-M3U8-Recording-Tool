const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

const CACHE_FILE = path.join(__dirname, '../data/iptv-list.json');
const CONFIG_FILE_PATH = path.join(__dirname, '../data', 'config.json');
const UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

// 配置代理
const PROXY_CONFIG = {
    host: '127.0.0.1',
    port: 7890
};

class IPTVService {
    constructor() {
        this.channels = [];
        this.lastUpdate = 0;
        this.isUpdating = false;
        this.config = null;

        // 创建支持代理的axios实例
        this.updateAxiosInstance();
    }

    // 读取配置文件
    async readConfig() {
        try {
            const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
            this.config = JSON.parse(configData);
            return this.config;
        } catch (error) {
            console.error('读取配置文件失败:', error);
            // 返回默认配置
            this.config = {
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
                proxyPort: 7890
            };
            return this.config;
        }
    }

    // 更新axios实例配置
    updateAxiosInstance() {
        const axiosConfig = {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        // 如果配置了使用代理，添加代理配置
        if (this.config && this.config.useProxy) {
            const proxyHost = this.config.proxyHost || PROXY_CONFIG.host;
            const proxyPort = this.config.proxyPort || PROXY_CONFIG.port;
            const proxyUrl = `http://${proxyHost}:${proxyPort}`;
            axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        this.axiosInstance = axios.create(axiosConfig);
    }

    async init() {
        try {
            // 首先读取配置文件
            await this.readConfig();

            // 更新axios实例配置
            this.updateAxiosInstance();

            // 尝试从缓存加载
            await this.loadFromCache();

            // 如果缓存过时或为空，更新频道
            if (this.shouldUpdate()) {
                await this.updateChannels();
            }

            // 设置定期更新
            const updateInterval = this.config.iptvUpdateInterval * 60 * 60 * 1000 || UPDATE_INTERVAL;
            setInterval(() => this.updateChannels(), updateInterval);
        } catch (error) {
            console.error('Error initializing IPTV service:', error);
        }
    }

    async loadFromCache() {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf8');
            const cache = JSON.parse(data);
            this.channels = cache.channels;
            this.lastUpdate = cache.lastUpdate;
            console.log(`Loaded ${this.channels.length} channels from cache`);
        } catch (error) {
            console.log('No cache file found or invalid cache');
            this.channels = [];
            this.lastUpdate = 0;
        }
    }

    shouldUpdate() {
        return Date.now() - this.lastUpdate > UPDATE_INTERVAL || this.channels.length === 0;
    }

    async updateChannels() {
        if (this.isUpdating) return;

        this.isUpdating = true;
        try {
            // 重新读取配置，确保使用最新的配置
            await this.readConfig();
            this.updateAxiosInstance();

            console.log('Updating IPTV channels from multiple sources...');

            // 获取启用的IPTV源
            const enabledSources = this.config.iptvSources.filter(source => source.enabled !== false);

            if (enabledSources.length === 0) {
                console.log('No enabled IPTV sources found');
                this.isUpdating = false;
                return;
            }

            const allChannels = [];

            // 从每个源获取频道
            for (const source of enabledSources) {
                try {
                    console.log(`Fetching channels from source: ${source.name}`);

                    // 处理GitHub URL的特殊情况
                    let sourceUrl = source.url;
                    if (sourceUrl.includes('github.com') && sourceUrl.includes('/blob/')) {
                        // 将GitHub blob URL转换为原始内容URL
                        sourceUrl = sourceUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
                    }

                    const response = await this.axiosInstance.get(sourceUrl);
                    const data = response.data;
                    const lines = data.split('\n');
                    const sourceChannels = [];

                    for (let i = 0; i < lines.length - 1; i++) {
                        if (lines[i].startsWith('#EXTINF')) {
                            const info = lines[i];
                            const url = lines[i + 1];

                            if (!url || url.trim().startsWith('#')) continue; // 跳过无效URL

                            const nameMatch = info.match(/tvg-name="([^"]+)"/);
                            const groupMatch = info.match(/group-title="([^"]+)"/);
                            const titleMatch = info.match(/,\s*(.+)$/);

                            sourceChannels.push({
                                name: nameMatch ? nameMatch[1] : (titleMatch ? titleMatch[1] : 'Unknown'),
                                group: groupMatch ? groupMatch[1] : 'Other',
                                url: url.trim(),
                                source: source.name // 添加源信息
                            });
                        }
                    }

                    console.log(`Found ${sourceChannels.length} channels from source: ${source.name}`);
                    allChannels.push(...sourceChannels);

                } catch (error) {
                    console.error(`Error fetching channels from source ${source.name}:`, error);
                    if (error.response) {
                        console.error('Response status:', error.response.status);
                    }
                }
            }

            // 合并所有频道并去重
            const uniqueUrls = new Set();
            this.channels = allChannels.filter(channel => {
                if (uniqueUrls.has(channel.url)) {
                    return false;
                }
                uniqueUrls.add(channel.url);
                return true;
            });

            this.lastUpdate = Date.now();

            // 保存到缓存
            await this.saveToCache();
            console.log(`IPTV channels updated successfully, total: ${this.channels.length} channels from ${enabledSources.length} sources`);
        } catch (error) {
            console.error('Error updating IPTV channels:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    async saveToCache() {
        const cacheDir = path.dirname(CACHE_FILE);
        try {
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.writeFile(CACHE_FILE, JSON.stringify({
                channels: this.channels,
                lastUpdate: this.lastUpdate
            }));
            console.log('Cache saved successfully');
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }

    getChannels() {
        return this.channels;
    }
}

const iptvService = new IPTVService();
module.exports = iptvService;

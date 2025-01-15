const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

const IPTV_URL = 'https://raw.githubusercontent.com/vbskycn/iptv/refs/heads/master/tv/iptv4.m3u';
const CACHE_FILE = path.join(__dirname, '../data/iptv-list.json');
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
        
        // 创建支持代理的axios实例
        const proxyUrl = `http://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        
        this.axiosInstance = axios.create({
            httpsAgent,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
    }

    async init() {
        try {
            // Try to load from cache first
            await this.loadFromCache();
            // Update if cache is old or empty
            if (this.shouldUpdate()) {
                await this.updateChannels();
            }
            // Start periodic updates
            setInterval(() => this.updateChannels(), UPDATE_INTERVAL);
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
            console.log('Updating IPTV channels...');
            const response = await this.axiosInstance.get(IPTV_URL);
            const data = response.data;
            const lines = data.split('\n');
            const channels = [];

            for (let i = 0; i < lines.length - 1; i++) {
                if (lines[i].startsWith('#EXTINF')) {
                    const info = lines[i];
                    const url = lines[i + 1];
                    
                    const nameMatch = info.match(/tvg-name="([^"]+)"/);
                    const groupMatch = info.match(/group-title="([^"]+)"/);
                    const titleMatch = info.match(/,\s*(.+)$/);

                    channels.push({
                        name: nameMatch ? nameMatch[1] : (titleMatch ? titleMatch[1] : 'Unknown'),
                        group: groupMatch ? groupMatch[1] : 'Other',
                        url: url.trim()
                    });
                }
            }

            this.channels = channels;
            this.lastUpdate = Date.now();

            // Save to cache
            await this.saveToCache();
            console.log(`IPTV channels updated successfully, total: ${channels.length} channels`);
        } catch (error) {
            console.error('Error updating IPTV channels:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
            }
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

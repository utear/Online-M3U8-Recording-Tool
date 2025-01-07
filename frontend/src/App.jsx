import { useState, useEffect, useRef, useCallback } from 'react'
import { Layout, Form, Input, Button, Card, Space, Select, Table, Tag, message, Collapse, Switch, InputNumber, Tooltip, Modal } from 'antd'
import {
  DesktopOutlined,
  FileOutlined,
  DeleteOutlined,
  StopOutlined,
  DownloadOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  VideoCameraOutlined,
  SendOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';

const { Header, Content } = Layout
const { Option } = Select
const { Panel } = Collapse

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002'

// 配置axios默认baseURL
axios.defaults.baseURL = API_BASE_URL;

// 添加请求拦截器
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 添加响应拦截器
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // 如果是未认证错误，清除token并跳转到登录页面
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 录制参数配置
const RECORDING_OPTIONS = {
  basic: [
    {
      name: 'save-dir',
      label: '保存目录',
      type: 'input',
      placeholder: '默认保存到 ./downloads',
      description: '设置输出目录，支持相对路径和绝对路径',
      tooltip: '--save-dir <save-dir>',
      defaultValue: './downloads',
    },
    {
      name: 'tmp-dir',
      label: '临时文件目录',
      type: 'input',
      placeholder: '默认保存到 ./temp',
      description: '设置临时文件存储目录，支持相对路径和绝对路径',
      tooltip: '--tmp-dir <tmp-dir>',
      defaultValue: './temp',
    },
    {
      name: 'save-name',
      label: '保存文件名',
      type: 'input',
      placeholder: '例如：weibo_live_20231231 或 hunan_tv_2024',
      description: '设置保存文件名，无需包含扩展名',
      tooltip: '--save-name <save-name>',
    },
    {
      name: 'thread-count',
      label: '下载线程数',
      type: 'select',
      options: [1, 2, 4, 8, 16],
      defaultValue: '4',
      description: '设置下载线程数，建议4-8个线程',
      tooltip: '--thread-count <number>',
    },
    {
      name: 'task-start-at',
      label: '定时开始',
      type: 'input',
      placeholder: '例如：20240101083000 表示2024年1月1日8点30分',
      description: '设置任务开始时间，格式：年月日时分秒',
      tooltip: '--task-start-at <yyyyMMddHHmmss>',
    },
    {
      name: 'check-segments-count',
      label: '检测分片数量',
      type: 'switch',
      defaultValue: true,
      description: '检测实际下载的分片数量和预期数量是否匹配',
      tooltip: '--check-segments-count',
      valuePropName: 'checked',
    },
    {
      name: 'append-url-params',
      label: '添加URL参数',
      type: 'switch',
      defaultValue: true,
      description: '将输入Url的Params添加至分片',
      tooltip: '--append-url-params',
      valuePropName: 'checked',
    },
    {
      name: 'live-real-time-merge',
      label: '实时合并',
      type: 'switch',
      defaultValue: true,
      description: '录制直播时实时合并分片',
      tooltip: '--live-real-time-merge',
      valuePropName: 'checked',
    },
    {
      name: 'live-keep-segments',
      label: '保留分片',
      type: 'switch',
      defaultValue: true,
      description: '保留直播录制的分片文件',
      tooltip: '--live-keep-segments',
      valuePropName: 'checked',
    },
  ],
  download: [
    {
      name: 'header',
      label: 'HTTP请求头',
      type: 'input',
      placeholder: '例如：Cookie: uid=123456 或 User-Agent: Mozilla/5.0',
      description: '设置HTTP请求头，可用于身份验证或自定义UA',
      tooltip: '-H, --header <header>',
    },
    {
      name: 'urlprocessor-args',
      label: 'URL处理器参数',
      type: 'input',
      placeholder: '例如：--auto-proxy 或 --max-retry 3',
      description: '传递给URL处理器的额外参数',
      tooltip: '--urlprocessor-args <urlprocessor-args>',
    },
    {
      name: 'base-url',
      label: '基础URL',
      type: 'input',
      placeholder: '设置BaseURL',
      description: '设置BaseURL',
      tooltip: '--base-url <base-url>',
    },
    {
      name: 'download-retry-count',
      label: '下载重试次数',
      type: 'number',
      defaultValue: 3,
      min: 0,
      description: '每个分片下载异常时的重试次数',
      tooltip: '--download-retry-count <number>',
    },
    {
      name: 'http-request-timeout',
      label: 'HTTP请求超时(秒)',
      type: 'number',
      defaultValue: 100,
      min: 1,
      description: 'HTTP请求的超时时间(秒)',
      tooltip: '--http-request-timeout <seconds>',
    },
    {
      name: 'max-speed',
      label: '下载限速',
      type: 'input',
      placeholder: '如：15M 或 100K',
      description: '设置限速，单位支持 Mbps 或 Kbps',
      tooltip: '-R, --max-speed <SPEED>',
    },
    {
      name: 'custom-proxy',
      label: '自定义代理',
      type: 'input',
      placeholder: '如：http://127.0.0.1:8888',
      description: '设置请求代理',
      tooltip: '--custom-proxy <URL>',
    },
    {
      name: 'custom-range',
      label: '下载范围',
      type: 'input',
      placeholder: '例如：1-100 或 5,10,15-20',
      description: '指定要下载的分片范围，支持单个、多个或范围',
      tooltip: '--custom-range <RANGE>',
    },
  ],
  live: [
    {
      name: 'live-record-limit',
      label: '录制时长限制',
      type: 'input',
      placeholder: '格式：HH:mm:ss',
      description: '录制直播时的录制时长限制',
      tooltip: '--live-record-limit <HH:mm:ss>',
    },
    {
      name: 'live-wait-time',
      label: '直播列表刷新间隔(秒)',
      type: 'number',
      min: 1,
      description: '手动设置直播列表刷新间隔',
      tooltip: '--live-wait-time <SEC>',
    },
    {
      name: 'live-take-count',
      label: '首次获取分片数量',
      type: 'number',
      defaultValue: 16,
      min: 1,
      description: '手动设置录制直播时首次获取分片的数量',
      tooltip: '--live-take-count <NUM>',
    },
    {
      name: 'live-perform-as-vod',
      label: '点播方式下载直播',
      type: 'switch',
      defaultValue: false,
      description: '以点播方式下载直播流',
      tooltip: '--live-perform-as-vod',
      valuePropName: 'checked',
    },
    {
      name: 'live-pipe-mux',
      label: '实时混流到TS文件',
      type: 'switch',
      defaultValue: false,
      description: '录制直播并开启实时合并时通过管道+ffmpeg实时混流到TS文件',
      tooltip: '--live-pipe-mux',
      valuePropName: 'checked',
    },
    {
      name: 'live-fix-vtt-by-audio',
      label: '通过音频修正VTT字幕',
      type: 'switch',
      defaultValue: false,
      description: '通过读取音频文件的起始时间修正VTT字幕',
      tooltip: '--live-fix-vtt-by-audio',
      valuePropName: 'checked',
    },
  ],
  processing: [
    {
      name: 'binary-merge',
      label: '二进制合并',
      type: 'switch',
      defaultValue: false,
      description: '二进制合并',
      tooltip: '--binary-merge',
      valuePropName: 'checked',
    },
    {
      name: 'use-ffmpeg-concat-demuxer',
      label: '使用ffmpeg concat分离器',
      type: 'switch',
      defaultValue: false,
      description: '使用 ffmpeg 合并时，使用 concat 分离器而非 concat 协议',
      tooltip: '--use-ffmpeg-concat-demuxer',
      valuePropName: 'checked',
    },
    {
      name: 'skip-merge',
      label: '跳过合并',
      type: 'switch',
      defaultValue: false,
      description: '跳过合并分片',
      tooltip: '--skip-merge',
      valuePropName: 'checked',
    },
    {
      name: 'skip-download',
      label: '跳过下载',
      type: 'switch',
      defaultValue: false,
      description: '跳过下载',
      tooltip: '--skip-download',
      valuePropName: 'checked',
    },
    {
      name: 'del-after-done',
      label: '完成后删除临时文件',
      type: 'switch',
      defaultValue: true,
      description: '完成后删除临时文件',
      tooltip: '--del-after-done',
      valuePropName: 'checked',
    },
    {
      name: 'mux-after-done',
      label: '完成后混流',
      type: 'input',
      placeholder: '如：format=mp4 或 format=mkv:muxer=mkvmerge',
      description: '所有工作完成时尝试混流分离的音视频',
      tooltip: '--mux-after-done <MUX-OPTIONS>',
    },
    {
      name: 'mux-import',
      label: '混流导入',
      type: 'input',
      placeholder: '如：path=zh-Hans.srt:lang=chi:name="中文"',
      description: '混流时引入外部媒体文件',
      tooltip: '--mux-import <MUX-OPTIONS>',
    },
    {
      name: 'auto-select',
      label: '自动选择最佳轨道',
      type: 'switch',
      defaultValue: false,
      description: '自动选择所有类型的最佳轨道',
      tooltip: '--auto-select',
      valuePropName: 'checked',
    },
  ],
  subtitle: [
    {
      name: 'sub-only',
      label: '仅下载字幕',
      type: 'switch',
      defaultValue: false,
      description: '只选取字幕轨道',
      tooltip: '--sub-only',
      valuePropName: 'checked',
    },
    {
      name: 'sub-format',
      label: '字幕格式',
      type: 'select',
      options: ['SRT', 'VTT'],
      defaultValue: 'SRT',
      description: '字幕输出类型',
      tooltip: '--sub-format <FORMAT>',
    },
    {
      name: 'auto-subtitle-fix',
      label: '自动修正字幕',
      type: 'switch',
      defaultValue: true,
      description: '自动修正字幕',
      tooltip: '--auto-subtitle-fix',
      valuePropName: 'checked',
    },
  ],
  system: [
    {
      name: 'use-system-proxy',
      label: '使用系统代理',
      type: 'switch',
      defaultValue: true,
      description: '使用系统默认代理',
      tooltip: '--use-system-proxy',
      valuePropName: 'checked',
    },
    {
      name: 'force-ansi-console',
      label: '强制ANSI终端',
      type: 'switch',
      defaultValue: false,
      description: '强制认定终端为支持ANSI且可交互的终端',
      tooltip: '--force-ansi-console',
      valuePropName: 'checked',
    },
    {
      name: 'no-ansi-color',
      label: '去除ANSI颜色',
      type: 'switch',
      defaultValue: false,
      description: '去除ANSI颜色',
      tooltip: '--no-ansi-color',
      valuePropName: 'checked',
    },
    {
      name: 'no-date-info',
      label: '不写入日期信息',
      type: 'switch',
      defaultValue: false,
      description: '混流时不写入日期信息',
      tooltip: '--no-date-info',
      valuePropName: 'checked',
    },
    {
      name: 'no-log',
      label: '关闭日志',
      type: 'switch',
      defaultValue: false,
      description: '关闭日志文件输出',
      tooltip: '--no-log',
      valuePropName: 'checked',
    },
    {
      name: 'write-meta-json',
      label: '输出元数据JSON',
      type: 'switch',
      defaultValue: true,
      description: '解析后的信息是否输出json文件',
      tooltip: '--write-meta-json',
      valuePropName: 'checked',
    },
    {
      name: 'ffmpeg-binary-path',
      label: 'ffmpeg路径',
      type: 'input',
      placeholder: '如：C:\\Tools\\ffmpeg.exe',
      description: 'ffmpeg可执行程序全路径',
      tooltip: '--ffmpeg-binary-path <PATH>',
    },
    {
      name: 'log-level',
      label: '日志级别',
      type: 'select',
      options: ['DEBUG', 'ERROR', 'INFO', 'OFF', 'WARN'],
      defaultValue: 'INFO',
      description: '设置日志级别',
      tooltip: '--log-level <LEVEL>',
    },
    {
      name: 'ui-language',
      label: 'UI语言',
      type: 'select',
      options: ['en-US', 'zh-CN', 'zh-TW'],
      defaultValue: 'zh-CN',
      description: '设置UI语言',
      tooltip: '--ui-language <LANG>',
    },
    {
      name: 'disable-update-check',
      label: '禁用更新检查',
      type: 'switch',
      defaultValue: false,
      description: '禁用版本更新检测',
      tooltip: '--disable-update-check',
      valuePropName: 'checked',
    },
  ],
  encryption: [
    {
      name: 'key',
      label: '解密密钥',
      type: 'input',
      placeholder: '格式：KID1:KEY1 或直接输入 KEY',
      description: '设置解密密钥',
      tooltip: '--key <KEY>',
    },
    {
      name: 'key-text-file',
      label: '密钥文件',
      type: 'input',
      placeholder: '密钥文件路径',
      description: '设置密钥文件',
      tooltip: '--key-text-file <FILE>',
    },
    {
      name: 'decryption-binary-path',
      label: '解密工具路径',
      type: 'input',
      placeholder: '如：C:\\Tools\\mp4decrypt.exe',
      description: 'MP4解密所用工具的全路径',
      tooltip: '--decryption-binary-path <PATH>',
    },
    {
      name: 'decryption-engine',
      label: '解密引擎',
      type: 'select',
      options: ['FFMPEG', 'MP4DECRYPT', 'SHAKA_PACKAGER'],
      defaultValue: 'MP4DECRYPT',
      description: '设置解密时使用的第三方程序',
      tooltip: '--decryption-engine <ENGINE>',
    },
    {
      name: 'custom-hls-method',
      label: 'HLS加密方式',
      type: 'select',
      options: ['AES_128', 'AES_128_ECB', 'CENC', 'CHACHA20', 'NONE', 'SAMPLE_AES', 'SAMPLE_AES_CTR', 'UNKNOWN'],
      description: '指定HLS加密方式',
      tooltip: '--custom-hls-method <METHOD>',
    },
    {
      name: 'custom-hls-key',
      label: 'HLS解密KEY',
      type: 'input',
      placeholder: '文件路径、HEX或Base64',
      description: '指定HLS解密KEY',
      tooltip: '--custom-hls-key <KEY>',
    },
    {
      name: 'custom-hls-iv',
      label: 'HLS解密IV',
      type: 'input',
      placeholder: '文件路径、HEX或Base64',
      description: '指定HLS解密IV',
      tooltip: '--custom-hls-iv <IV>',
    },
    {
      name: 'mp4-real-time-decryption',
      label: '实时解密MP4',
      type: 'switch',
      defaultValue: false,
      description: '实时解密MP4分片',
      tooltip: '--mp4-real-time-decryption',
      valuePropName: 'checked',
    },
  ],
  selection: [
    {
      name: 'select-video',
      label: '视频流选择',
      type: 'input',
      placeholder: '如：res="3840*":codecs=hvc1:for=best',
      description: '通过正则表达式选择符合要求的视频流',
      tooltip: '--select-video <EXPR>',
    },
    {
      name: 'select-audio',
      label: '音频流选择',
      type: 'input',
      placeholder: '如：lang=en:for=best',
      description: '通过正则表达式选择符合要求的音频流',
      tooltip: '--select-audio <EXPR>',
    },
    {
      name: 'select-subtitle',
      label: '字幕流选择',
      type: 'input',
      placeholder: '如：name="中文":for=all',
      description: '通过正则表达式选择符合要求的字幕流',
      tooltip: '--select-subtitle <EXPR>',
    },
    {
      name: 'drop-video',
      label: '排除视频流',
      type: 'input',
      placeholder: '正则表达式',
      description: '通过正则表达式去除符合要求的视频流',
      tooltip: '--drop-video <EXPR>',
    },
    {
      name: 'drop-audio',
      label: '排除音频流',
      type: 'input',
      placeholder: '正则表达式',
      description: '通过正则表达式去除符合要求的音频流',
      tooltip: '--drop-audio <EXPR>',
    },
    {
      name: 'drop-subtitle',
      label: '排除字幕流',
      type: 'input',
      placeholder: '正则表达式',
      description: '通过正则表达式去除符合要求的字幕流',
      tooltip: '--drop-subtitle <EXPR>',
    },
    {
      name: 'ad-keyword',
      label: '广告关键字',
      type: 'input',
      placeholder: '正则表达式',
      description: '设置广告分片的URL关键字',
      tooltip: '--ad-keyword <EXPR>',
    },
    {
      name: 'allow-hls-multi-ext-map',
      label: '允许多个EXT-X-MAP',
      type: 'switch',
      defaultValue: false,
      description: '允许HLS中的多个#EXT-X-MAP(实验性)',
      tooltip: '--allow-hls-multi-ext-map',
      valuePropName: 'checked',
    },
  ],
}

const terminalStyle = {
  backgroundColor: '#000',
  color: '#fff',
  fontFamily: 'Consolas, monospace',
  padding: '10px',
  height: '400px',
  overflowY: 'auto',
  whiteSpace: 'pre',
  wordWrap: 'break-word'
};

const inputStyle = {
  backgroundColor: '#000',
  color: '#fff',
  fontFamily: 'Consolas, monospace',
  border: 'none',
  outline: 'none',
  width: '100%',
  padding: '5px'
};

// 权限验证组件
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token || !['superadmin', 'admin'].includes(user.role)) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function AppContent() {
  const [form] = Form.useForm();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState(null);
  const [terminals, setTerminals] = useState(new Map());
  const [activeTerminal, setActiveTerminal] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const subscribedTasksRef = useRef(new Set());
  const terminalsRef = useRef(new Map());
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const navigate = useNavigate();
  const [taskHistory, setTaskHistory] = useState([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // 处理终端订阅
  const subscribeToTask = useCallback((taskId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('WebSocket未连接，无法订阅任务');
      return false;
    }
    
    if (subscribedTasksRef.current.has(taskId)) {
      console.log('任务已订阅:', taskId);
      return true;
    }
    
    console.log('订阅任务:', taskId);
    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      taskId
    }));
    subscribedTasksRef.current.add(taskId);
    return true;
  }, []);

  // 关闭控制台
  const closeConsole = useCallback((taskId) => {
    console.log('关闭控制台:', taskId);
    
    // 取消订阅
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        taskId
      }));
      subscribedTasksRef.current.delete(taskId);
    }
    
    // 更新终端状态
    setTerminals(prev => {
      const newTerminals = new Map(prev);
      if (newTerminals.has(taskId)) {
        const terminal = newTerminals.get(taskId);
        terminal.visible = false;
        // 保留输出，但清空输入
        terminal.input = '';
        newTerminals.set(taskId, { ...terminal });
        terminalsRef.current = newTerminals;
      }
      return newTerminals;
    });
    
    if (activeTerminal === taskId) {
      setActiveTerminal(null);
    }
  }, [activeTerminal]);

  // 打开控制台
  const openConsole = useCallback((taskId) => {
    console.log('打开控制台:', taskId);
    
    // 先更新终端状态
    setTerminals(prev => {
      const newTerminals = new Map(prev);
      const terminal = newTerminals.get(taskId) || { 
        output: '', 
        visible: true,
        input: ''
      };
      terminal.visible = true;
      newTerminals.set(taskId, { ...terminal });
      terminalsRef.current = newTerminals;
      return newTerminals;
    });
    
    // 确保WebSocket连接已建立并订阅
    const trySubscribe = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // 先请求历史记录
        wsRef.current.send(JSON.stringify({
          type: 'get_history',
          taskId
        }));
        
        // 然后订阅新的输出
        subscribeToTask(taskId);
        return true;
      }
      return false;
    };
    
    // 如果当前无法订阅，设置重试
    if (!trySubscribe()) {
      console.log('订阅失败，开始重试');
      const retrySubscribe = setInterval(() => {
        if (trySubscribe()) {
          console.log('重试订阅成功');
          clearInterval(retrySubscribe);
        }
      }, 1000);
      
      // 30秒后停止重试
      setTimeout(() => {
        clearInterval(retrySubscribe);
        console.log('停止重试订阅');
      }, 30000);
    }
    
    setActiveTerminal(taskId);
  }, [subscribeToTask]);

  // 处理终端输入
  const handleTerminalInput = useCallback((taskId, input, e) => {
    if (e.key === 'Enter' && input.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
      const trimmedInput = input.trim();
      
      // 添加输入到终端输出
      setTerminals(prev => {
        const newTerminals = new Map(prev);
        const terminal = newTerminals.get(taskId);
        if (terminal) {
          // 添加用户输入到输出，不额外换行
          terminal.output += (terminal.output.endsWith('\n') ? '' : '\n') + `$ ${trimmedInput}`;
          terminal.input = '';
          newTerminals.set(taskId, { ...terminal });
          terminalsRef.current = newTerminals;
          
          // 自动滚动到底部
          requestAnimationFrame(() => {
            const terminalElement = document.querySelector(`#terminal-${taskId}`);
            if (terminalElement) {
              terminalElement.scrollTop = terminalElement.scrollHeight;
            }
          });
        }
        return newTerminals;
      });
      
      // 发送输入到后端
      wsRef.current.send(JSON.stringify({
        type: 'process_input',
        taskId,
        input: trimmedInput
      }));
    }
  }, []);

  // 渲染终端模态框
  const renderTerminals = useCallback(() => {
    return Array.from(terminals.entries()).map(([taskId, terminal]) => (
      <Modal
        key={taskId}
        title={`任务 ${taskId} 的控制台`}
        open={terminal.visible}
        onCancel={() => closeConsole(taskId)}
        width={800}
        footer={null}
        maskClosable={false}
        destroyOnClose={false}
      >
        <div 
          id={`terminal-${taskId}`}
          style={{
            ...terminalStyle,
            height: '400px',
            overflowY: 'auto',
            padding: '10px',
            fontFamily: 'Consolas, monospace',
            whiteSpace: 'pre',
            wordWrap: 'break-word'
          }}
          ref={el => {
            if (el) {
              el.scrollTop = el.scrollHeight;
            }
          }}
        >
          {terminal.output}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
          <span style={{ color: '#fff', marginRight: '8px' }}>$</span>
          <Input
            style={{
              ...inputStyle,
              flex: 1
            }}
            value={terminal.input || ''}
            onChange={e => {
              setTerminals(prev => {
                const newTerminals = new Map(prev);
                const terminal = newTerminals.get(taskId);
                if (terminal) {
                  terminal.input = e.target.value;
                  newTerminals.set(taskId, { ...terminal });
                }
                return newTerminals;
              });
            }}
            onKeyPress={e => handleTerminalInput(taskId, terminal.input || '', e)}
            placeholder="输入命令并按回车发送..."
            autoFocus
          />
        </div>
      </Modal>
    ));
  }, [terminals, closeConsole, handleTerminalInput]);

  // 格式化终端输出
  const formatTerminalOutput = (output) => {
    return output
      .replace(/\n\s*\n/g, '\n') // 移除多余的空行
      .replace(/\r\n/g, '\n') // 统一换行符
      .split('\n')
      .filter(line => line.trim()) // 移除空行
      .join('\n');
  };

  // WebSocket连接
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
      }
      
      clearTimeout(reconnectTimeoutRef.current);
      
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket客户端已连接');
        // 重新订阅所有可见的终端
        const currentTerminals = terminalsRef.current || new Map();
        currentTerminals.forEach((terminal, taskId) => {
          if (terminal.visible) {
            subscribeToTask(taskId);
          }
        });
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('收到WebSocket消息:', data);
          
          switch (data.type) {
            case 'terminal_output':
            case 'terminal_history':
              setTerminals(prev => {
                const newTerminals = new Map(prev);
                const terminal = newTerminals.get(data.taskId) || {
                  output: '',
                  visible: false,
                  input: ''
                };
                
                if (data.type === 'terminal_history') {
                  terminal.output = formatTerminalOutput(data.output);
                } else {
                  const newOutput = formatTerminalOutput(data.output);
                  if (newOutput) {
                    terminal.output = terminal.output ? 
                      terminal.output + (terminal.output.endsWith('\n') ? '' : '\n') + newOutput :
                      newOutput;
                  }
                }
                
                newTerminals.set(data.taskId, { ...terminal });
                terminalsRef.current = newTerminals;
                
                // 使用 RAF 确保滚动发生在 DOM 更新之后
                requestAnimationFrame(() => {
                  const terminalElement = document.querySelector(`#terminal-${data.taskId}`);
                  if (terminalElement && terminalElement.scrollHeight > terminalElement.clientHeight) {
                    terminalElement.scrollTop = terminalElement.scrollHeight;
                  }
                });
                
                return newTerminals;
              });
              break;

            case 'progress':
              // 更新任务列表中的最新输出
              setTasks(prevTasks => {
                return prevTasks.map(task => {
                  if (task.id === data.taskId) {
                    return {
                      ...task,
                      lastOutput: formatTerminalOutput(data.output),
                      fileSize: data.fileSize
                    };
                  }
                  return task;
                });
              });
              
              // 更新终端输出，但确保不重复添加相同的输出
              setTerminals(prev => {
                const newTerminals = new Map(prev);
                const terminal = newTerminals.get(data.taskId);
                if (terminal) {
                  const newOutput = formatTerminalOutput(data.output);
                  if (newOutput) {
                    // 检查最后一行是否与新输出相同，避免重复
                    const lastLine = terminal.output.split('\n').pop() || '';
                    if (lastLine.trim() !== newOutput.trim()) {
                      terminal.output = terminal.output + (terminal.output.endsWith('\n') ? '' : '\n') + newOutput;
                      newTerminals.set(data.taskId, { ...terminal });
                      terminalsRef.current = newTerminals;
                    }
                  }
                }
                return newTerminals;
              });
              break;
              
            case 'status':
              setTasks(prevTasks => {
                return prevTasks.map(task => {
                  if (task.id === data.taskId) {
                    return {
                      ...task,
                      status: data.status
                    };
                  }
                  return task;
                });
              });
              break;
          }
        } catch (error) {
          console.error('处理WebSocket消息时出错:', error);
        }
      });

      ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          console.log('WebSocket客户端已断开');
          wsRef.current = null;
          // 标记所有终端为未订阅
          subscribedTasksRef.current.clear();
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        }
      };
    };

    connectWebSocket();
    
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        subscribedTasksRef.current.clear();
        ws.onclose = null;
        ws.close();
      }
    };
  }, [subscribeToTask]);

  useEffect(() => {
    // 设置表单的初始值
    form.setFieldsValue({
      'save-dir': './downloads',
      'tmp-dir': './temp',
      'check-segments-count': true,
      'append-url-params': true,
      'live-real-time-merge': true,
      'live-keep-segments': true,
      'thread-count': '4'
    });
  }, []);

  // 开始录制
  const handleStartRecording = async (values) => {
    try {
      setLoading(true)
      const options = {}
      
      // 处理所有配置项
      Object.keys(RECORDING_OPTIONS).forEach(category => {
        RECORDING_OPTIONS[category].forEach(option => {
          if (values[option.name] !== undefined && values[option.name] !== '') {
            options[option.name] = values[option.name]
          }
        })
      })

      const response = await axios.post(`${API_BASE_URL}/api/start-recording`, {
        url: values.url,
        options
      })
      
      message.success('开始录制')
      form.resetFields()
      fetchTasks()
    } catch (error) {
      message.error('开始录制失败')
    } finally {
      setLoading(false)
    }
  }

  // 停止录制
  const handleStopRecording = async (taskId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/stop-recording/${taskId}`)
      message.success('停止录制')
      fetchTasks()
    } catch (error) {
      message.error('停止录制失败')
    }
  }

  // 渲染表单项
  const renderFormItem = (option) => {
    switch (option.type) {
      case 'input':
        return <Input placeholder={option.placeholder} />;
      case 'select':
        return (
          <Select>
            {option.options.map(value => (
              <Option key={value} value={value.toString()}>{value}</Option>
            ))}
          </Select>
        );
      case 'number':
        return <InputNumber min={option.min} style={{ width: '100%' }} />;
      case 'switch':
        return <Switch defaultChecked={option.defaultValue} />;
      default:
        return null;
    }
  }

  const getCollapseItems = () => {
    const categories = [
      { key: 'basic', label: '基本设置', required: true },
      { key: 'download', label: '下载设置', required: false },
      { key: 'live', label: '直播设置', required: false },
      { key: 'processing', label: '处理设置', required: false },
      { key: 'subtitle', label: '字幕设置', required: false },
      { key: 'system', label: '系统设置', required: false },
      { key: 'encryption', label: '加密设置', required: false },
      { key: 'selection', label: '流选择设置', required: false },
    ];

    return categories.map(category => ({
      key: category.key,
      label: (
        <Space>
          <span>{category.label}</span>
          <Tag color={category.required ? 'red' : 'blue'}>
            {category.required ? '必选' : '可选'}
          </Tag>
        </Space>
      ),
      children: (
        <div className="form-grid">
          {RECORDING_OPTIONS[category.key].map(option => (
            <Form.Item
              key={option.name}
              name={option.name}
              label={
                <Tooltip title={
                  <div>
                    <div>{option.description}</div>
                    <div style={{ marginTop: '8px', color: '#1890ff' }}>命令行参数: {option.tooltip}</div>
                  </div>
                }>
                  <Space>
                    {option.label}
                    <QuestionCircleOutlined />
                  </Space>
                </Tooltip>
              }
              rules={[{ required: option.required, message: `请输入${option.label}` }]}
            >
              {renderFormItem(option)}
            </Form.Item>
          ))}
        </div>
      )
    }));
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'running':
        return <Tag color="processing">录制中</Tag>
      case 'completed':
        return <Tag color="success">已完成</Tag>
      case 'paused':
        return <Tag color="warning">已暂停</Tag>
      case 'failed':
        return <Tag color="error">录制失败</Tag>
      default:
        return <Tag>{status}</Tag>
    }
  }

  const renderTaskControls = (record) => (
    <div className="operation-buttons">
      {record.status === 'running' && (
        <Button
          type="primary"
          danger
          icon={<StopOutlined />}
          onClick={() => handleStopRecording(record.id)}
        >
          停止
        </Button>
      )}
      {(record.status === 'completed' || record.status === 'paused') && (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => handleDownload(record)}
        >
          下载
        </Button>
      )}
      <Button
        type="primary"
        icon={<DesktopOutlined />}
        onClick={() => openConsole(record.id)}
      >
        控制台
      </Button>
      <Button
        type="default"
        icon={<HistoryOutlined />}
        onClick={() => viewHistory(record.id)}
      >
        历史
      </Button>
      <Button
        type="primary"
        danger
        icon={<DeleteOutlined />}
        onClick={() => deleteTask(record.id)}
      >
        删除
      </Button>
    </div>
  );

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      className: 'task-id-column'
    },
    {
      title: '视频流地址',
      dataIndex: 'url',
      key: 'url',
      className: 'task-url-column',
      render: (url) => (
        <Tooltip title={url}>
          <span>{url}</span>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      className: 'task-status-column',
      render: (status) => getStatusTag(status)
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      className: 'task-time-column',
      render: (time) => time ? new Date(time).toLocaleString() : '-'
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      className: 'task-size-column',
      render: (size) => formatFileSize(size)
    },
    {
      title: '最新输出',
      dataIndex: 'lastOutput',
      key: 'lastOutput',
      className: 'task-output-column',
      render: (output) => (
        <Tooltip title={output}>
          <span>{output || '-'}</span>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      className: 'operation-column',
      render: (_, record) => renderTaskControls(record)
    }
  ];

  // 格式化文件大小的辅助函数
  const formatFileSize = (size) => {
    if (!size) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  };

  // 处理下载
  const handleDownload = async (task) => {
    try {
      // 直接使用 window.open 打开下载链接
      window.open(`${API_BASE_URL}/api/download/${task.id}`, '_blank');
    } catch (error) {
      message.error('下载失败: ' + error.message);
    }
  };

  // 查看任务历史记录
  const viewHistory = async (taskId) => {
    try {
      setSelectedTaskId(taskId);
      const response = await axios.get(`/api/tasks/${taskId}/history`);
      setTaskHistory(response.data);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('获取任务历史失败:', error);
      message.error('获取任务历史失败');
    }
  };

  // 渲染历史记录模态框
  const renderHistoryModal = () => (
    <Modal
      title="任务历史记录"
      open={historyModalVisible}
      onCancel={() => setHistoryModalVisible(false)}
      footer={[
        <Button key="close" onClick={() => setHistoryModalVisible(false)}>
          关闭
        </Button>
      ]}
      width={800}
    >
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {taskHistory.map((record, index) => (
          <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee' }}>
            <div style={{ marginBottom: '5px', color: '#666' }}>
              {new Date(record.timestamp).toLocaleString()}
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {record.output}
            </pre>
          </div>
        ))}
      </div>
    </Modal>
  );

  // 删除任务
  const deleteTask = async (taskId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个任务吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/api/tasks/${taskId}`);
          message.success('任务已删除');
          fetchTasks();
        } catch (error) {
          console.error('删除任务失败:', error);
          message.error('删除任务失败');
        }
      }
    });
  };

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tasks`)
      setTasks(response.data)
    } catch (error) {
      message.error('获取任务列表失败')
    }
  }

  // 定期刷新任务列表
  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#f5222d', 
        padding: '0 16px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <div style={{ 
          color: '#fff', 
          fontSize: '20px', 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          <VideoCameraOutlined style={{ marginRight: '8px' }} />
          <span>直播录制工具</span>
        </div>
        <Button 
          type="primary" 
          ghost 
          icon={<DesktopOutlined />}
          onClick={() => navigate('/dashboard')}
          style={{ color: '#fff', borderColor: '#fff' }}
        >
          仪表盘登录
        </Button>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Form
          form={form}
          onFinish={handleStartRecording}
          layout="vertical"
        >
          <Form.Item
            name="url"
            label={
              <Tooltip title="支持m3u/m3u8/视频流地址">
                <Space>
                  视频流地址
                  <QuestionCircleOutlined />
                </Space>
              </Tooltip>
            }
            rules={[{ required: true, message: '请输入视频流地址' }]}
            className="url-input"
          >
            <Input.TextArea
              placeholder="请输入视频流地址"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>

          <Collapse
            ghost
            className="settings-collapse"
            defaultActiveKey={['basic']}
            items={getCollapseItems()}
          />

          <Form.Item className="submit-button">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<PlayCircleOutlined />}
              size="large"
            >
              开始录制
            </Button>
          </Form.Item>
        </Form>
        <Card title="任务列表" style={{ marginTop: '24px' }}>
          <Table
            dataSource={tasks}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        </Card>
        {renderTerminals()}
        {renderHistoryModal()}
      </Content>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App

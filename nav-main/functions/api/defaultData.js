/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * defaultData.js - 默认初始化数据
 * 包含分类和网站条目的默认配置
 * 
 * ==========================================
 */

export const defaultData = {
  // 全局设置
  settings: { 
    zenMode: false, 
    link_target: '_blank',
    hideBgMask: true,
    isolatedView: false,
    density: 'standard',
    showFrequent: true,
    bgUrl: '',
    syncInterval: 7 // Task節流.1: 默认 7 天备份一次
  },

  // 分类列表
  categories: [
    { id: "A01", name: "社交", icon: "💬", hidden: false },
    { id: "B01", name: "视频", icon: "🎬", hidden: false },
    { id: "C01", name: "新闻", icon: "📰", hidden: false },
    { id: "D01", name: "AI", icon: "🤖", hidden: false }
  ],

  // 网站条目列表 (精选 5x4 矩阵)
  items: [
    // ===== 社交分类 (A01) =====
    { id: "A001", catId: "A01", title: "微博", url: "https://weibo.com/", desc: "随时随地发现新鲜事", icon: "", hidden: false },
    { id: "A002", catId: "A01", title: "豆瓣", url: "https://www.douban.com/", desc: "我们的精神角落", icon: "", hidden: false },
    { id: "A003", catId: "A01", title: "知乎", url: "https://www.zhihu.com/", desc: "有问题，就会有答案", icon: "", hidden: false },
    { id: "A004", catId: "A01", title: "百度贴吧", url: "https://tieba.baidu.com/", desc: "全球领先的中文社区", icon: "", hidden: false },
    { id: "A005", catId: "A01", title: "小红书", url: "https://www.xiaohongshu.com/", desc: "标记我的生活", icon: "", hidden: false },

    // ===== 视频分类 (B01) =====
    { id: "B001", catId: "B01", title: "哔哩哔哩", url: "https://www.bilibili.com/", desc: "(゜-゜)つロ 干杯~", icon: "", hidden: false },
    { id: "B002", catId: "B01", title: "抖音", url: "https://www.douyin.com/", desc: "记录美好生活", icon: "", hidden: false },
    { id: "B003", catId: "B01", title: "腾讯视频", url: "https://v.qq.com/", desc: "不负好时光", icon: "", hidden: false },
    { id: "B004", catId: "B01", title: "爱奇艺", url: "https://www.iqiyi.com/", desc: "悦享品质", icon: "", hidden: false },
    { id: "B005", catId: "B01", title: "芒果TV", url: "https://www.mgtv.com/", desc: "天生青春", icon: "", hidden: false },

    // ===== 新闻分类 (C01) =====
    { id: "C001", catId: "C01", title: "今日头条", url: "https://www.toutiao.com/", desc: "信息创造价值", icon: "", hidden: false },
    { id: "C002", catId: "C01", title: "澎湃新闻", url: "https://www.thepaper.cn/", desc: "专注时政与思想", icon: "", hidden: false },
    { id: "C003", catId: "C01", title: "腾讯新闻", url: "https://news.qq.com/", desc: "事实派", icon: "", hidden: false },
    { id: "C004", catId: "C01", title: "网易新闻", url: "https://news.163.com/", desc: "各有态度", icon: "", hidden: false },
    { id: "C005", catId: "C01", title: "新浪新闻", url: "https://news.sina.com.cn/", desc: "最新最全", icon: "", hidden: false },

    // ===== AI分类 (D01) =====
    { id: "D001", catId: "D01", title: "文心一言", url: "https://yiyan.baidu.com/", desc: "百度 AI 助手", icon: "", hidden: false },
    { id: "D002", catId: "D01", title: "通义千问", url: "https://chat.qwen.ai/", desc: "阿里 AI 助手", icon: "", hidden: false },
    { id: "D003", catId: "D01", title: "Kimi", url: "https://www.kimi.com/", desc: "超长上下文 AI", icon: "", hidden: false },
    { id: "D004", catId: "D01", title: "豆包", url: "https://www.doubao.com/", desc: "字节 AI 助手", icon: "", hidden: false },
    { id: "D005", catId: "D01", title: "DeepSeek", url: "https://www.deepseek.com/", desc: "深度求索 AI", icon: "", hidden: false }
  ]
};

/**
 * Task 6.1.1: 工业级底层兜底配置 (Hard-bottom Fallback)
 * 当外部模板和内置 defaultData 都损坏时的最终防线
 */
export const MINIMAL_SAFE_DATA = {
  settings: { zenMode: true, link_target: '_blank', themeMode: "auto" },
  categories: [
    { id: "f-cat-1", name: "常用搜索", icon: "🔍", hidden: false },
    { id: "f-cat-2", name: "影音视频", icon: "🎬", hidden: false },
    { id: "f-cat-3", name: "社交资讯", icon: "📱", hidden: false },
    { id: "f-cat-4", name: "实用工具", icon: "🛠️", hidden: false }
  ],
  items: [
    { id: "f-i-1", catId: "f-cat-1", title: "百度", url: "https://www.baidu.com/", desc: "百度一下，你就知道", icon: "", hidden: false },
    { id: "f-i-2", catId: "f-cat-1", title: "知乎", url: "https://www.zhihu.com/", desc: "有问题，就会有答案", icon: "", hidden: false },
    { id: "f-i-3", catId: "f-cat-1", title: "GitHub", url: "https://github.com/", desc: "全球开发者社区", icon: "", hidden: false },
    { id: "f-i-4", catId: "f-cat-2", title: "哔哩哔哩", url: "https://www.bilibili.com/", desc: "干杯~", icon: "", hidden: false },
    { id: "f-i-5", catId: "f-cat-2", title: "腾讯视频", url: "https://v.qq.com/", desc: "不负好时光", icon: "", hidden: false },
    { id: "f-i-6", catId: "f-cat-2", title: "抖音", url: "https://www.douyin.com/", desc: "记录美好生活", icon: "", hidden: false },
    { id: "f-i-7", catId: "f-cat-3", title: "微博", url: "https://weibo.com/", desc: "发现新鲜事", icon: "", hidden: false },
    { id: "f-i-8", catId: "f-cat-3", title: "豆瓣", url: "https://www.douban.com/", desc: "我们的精神角落", icon: "", hidden: false },
    { id: "f-i-9", catId: "f-cat-3", title: "小红书", url: "https://www.xiaohongshu.com/", desc: "标记我的生活", icon: "", hidden: false },
    { id: "f-i-10", catId: "f-cat-4", title: "高德地图", url: "https://www.amap.com/", desc: "高德在手，天下我有", icon: "", hidden: false },
    { id: "f-i-11", catId: "f-cat-4", title: "百度翻译", url: "https://fanyi.baidu.com/", desc: "200种语言互译", icon: "", hidden: false },
    { id: "f-i-12", catId: "f-cat-4", title: "网易云音乐", url: "https://music.163.com/", desc: "传递音乐力量", icon: "", hidden: false }
  ]
};

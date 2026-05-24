/**
 * ==========================================
 * defaultData.js - 默认初始化数据
 * 包含分类和网站条目的默认配置
 * 
 * ==========================================
 */

export const defaultData = {
  // 全局设置
  settings: { cardWidth: 125 },

  // 分类列表
  categories: [
    { id: "A01", name: "社交", icon: "💬", hidden: false },
    { id: "B01", name: "视频", icon: "🎬", hidden: false },
    { id: "C01", name: "新闻", icon: "📰", hidden: false },
    { id: "D01", name: "AI", icon: "🤖", hidden: false }
  ],

  // 网站条目列表
  items: [
    // ===== 社交分类 (A01) =====
    { id: "A001", catId: "A01", title: "知乎", url: "https://www.zhihu.com/", desc: "问答社区", icon: "https://favicon.im/www.zhihu.com", hidden: false },
    { id: "A002", catId: "A01", title: "豆瓣", url: "https://www.douban.com/", desc: "书影音社区", icon: "https://favicon.im/www.douban.com", hidden: false },
    { id: "A003", catId: "A01", title: "百度贴吧", url: "https://tieba.baidu.com/", desc: "兴趣社区", icon: "https://favicon.im/tieba.baidu.com", hidden: false },
    { id: "A004", catId: "A01", title: "新浪微博", url: "https://weibo.com/", desc: "微博客平台", icon: "https://favicon.im/weibo.com", hidden: false },
    { id: "A005", catId: "A01", title: "虎扑社区", url: "https://www.hupu.com/", desc: "体育社区", icon: "https://favicon.im/www.hupu.com", hidden: false },
    { id: "A006", catId: "A01", title: "微信网页版", url: "https://wx.qq.com/", desc: "微信网页版", icon: "https://favicon.im/wx.qq.com", hidden: false },
    { id: "A007", catId: "A01", title: "QQ空间", url: "https://qzone.qq.com/", desc: "QQ社交空间", icon: "https://favicon.im/qzone.qq.com", hidden: false },
    { id: "A008", catId: "A01", title: "煎蛋网", url: "https://jandan.net/", desc: "趣图段子", icon: "https://favicon.im/jandan.net", hidden: false },

    // ===== 视频分类 (B01) =====
    { id: "B001", catId: "B01", title: "腾讯视频", url: "https://v.qq.com/", desc: "视频平台", icon: "https://favicon.im/v.qq.com", hidden: false },
    { id: "B002", catId: "B01", title: "优酷网", url: "https://www.youku.com/", desc: "视频平台", icon: "https://favicon.im/www.youku.com", hidden: false },
    { id: "B003", catId: "B01", title: "芒果TV", url: "https://www.mgtv.com/", desc: "湖南卫视", icon: "https://favicon.im/www.mgtv.com", hidden: false },
    { id: "B004", catId: "B01", title: "搜狐视频", url: "https://tv.sohu.com/", desc: "视频平台", icon: "https://favicon.im/tv.sohu.com", hidden: false },
    { id: "B005", catId: "B01", title: "斗鱼TV", url: "https://www.douyu.com/", desc: "游戏直播", icon: "https://favicon.im/www.douyu.com", hidden: false },
    { id: "B006", catId: "B01", title: "哔哩哔哩", url: "https://www.bilibili.com/", desc: "弹幕视频", icon: "https://favicon.im/www.bilibili.com", hidden: false },
    { id: "B007", catId: "B01", title: "虎牙直播", url: "https://www.huya.com/", desc: "游戏直播", icon: "https://favicon.im/www.huya.com", hidden: false },
    { id: "B008", catId: "B01", title: "爱奇艺", url: "https://www.iqiyi.com/", desc: "视频平台", icon: "https://favicon.im/www.iqiyi.com", hidden: false },
    { id: "B009", catId: "B01", title: "ACfun", url: "https://www.acfun.cn/", desc: "弹幕视频", icon: "https://favicon.im/www.acfun.cn", hidden: false },

    // ===== 新闻分类 (C01) =====
    { id: "C001", catId: "C01", title: "新浪新闻", url: "https://news.sina.com.cn/", desc: "综合新闻", icon: "https://favicon.im/news.sina.com.cn", hidden: false },
    { id: "C002", catId: "C01", title: "腾讯新闻", url: "https://news.qq.com/", desc: "综合新闻", icon: "https://favicon.im/news.qq.com", hidden: false },
    { id: "C003", catId: "C01", title: "凤凰军事", url: "https://news.ifeng.com/mil/", desc: "军事新闻", icon: "https://favicon.im/news.ifeng.com", hidden: false },
    { id: "C004", catId: "C01", title: "网易新闻", url: "https://news.163.com/", desc: "综合新闻", icon: "https://favicon.im/news.163.com", hidden: false },
    { id: "C005", catId: "C01", title: "环球网", url: "https://www.huanqiu.com/", desc: "国际新闻", icon: "https://favicon.im/www.huanqiu.com", hidden: false },
    { id: "C006", catId: "C01", title: "参考消息", url: "http://www.cankaoxiaoxi.com/", desc: "参考消息", icon: "https://favicon.im/www.cankaoxiaoxi.com", hidden: false },
    { id: "C007", catId: "C01", title: "博海拾贝", url: "https://www.bohaishibei.com/", desc: "资讯聚合", icon: "https://favicon.im/bohaishibei.com", hidden: false },

    // ===== AI分类 (D01) =====
    { id: "D001", catId: "D01", title: "ChatGPT", url: "https://chat.openai.com/", desc: "OpenAI助手", icon: "https://img.icons8.com/ios/100/FFFFFF/chatgpt.png", hidden: false },
    { id: "D002", catId: "D01", title: "Grok", url: "https://grok.com/", desc: "X平台AI", icon: "https://favicon.im/grok.com", hidden: false },
    { id: "D003", catId: "D01", title: "阿里千问", url: "https://chat.qwen.ai/", desc: "阿里AI助手", icon: "https://favicon.im/chat.qwen.ai", hidden: false },
    { id: "D004", catId: "D01", title: "DeepSeek", url: "https://chat.deepseek.com/", desc: "深度求索AI", icon: "https://favicon.im/chat.deepseek.com", hidden: false },
    { id: "D005", catId: "D01", title: "豆包", url: "https://www.doubao.com/chat/", desc: "字节AI助手", icon: "https://favicon.im/www.doubao.com", hidden: false },
    { id: "D006", catId: "D01", title: "Kimi", url: "https://www.kimi.com/", desc: "月之暗面AI", icon: "https://favicon.im/www.kimi.com", hidden: false },
    { id: "D007", catId: "D01", title: "元宝", url: "https://yuanbao.tencent.com/", desc: "腾讯AI助手", icon: "https://favicon.im/yuanbao.tencent.com", hidden: false },
    { id: "D008", catId: "D01", title: "即梦AI", url: "https://jimeng.jianying.com/", desc: "字节AI绘画", icon: "https://favicon.im/jimeng.jianying.com", hidden: false },
    { id: "D009", catId: "D01", title: "Gemini", url: "https://gemini.google.com/", desc: "谷歌AI助手", icon: "https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg", hidden: false }
  ]
};
/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * bing.js - Bing 每日壁纸代理
 * 路由: /api/bing
 * ==========================================
 */

export async function onRequestGet() {
  try {
    const res = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1");
    const data = await res.json();
    
    // Task 18.1: 标准化 URL 为绝对路径，防止前端加载失败
    if (data.images && data.images.length > 0) {
      data.images = data.images.map(img => ({
        ...img,
        url: img.url.startsWith('http') ? img.url : `https://www.bing.com${img.url}`,
        urlbase: img.urlbase.startsWith('http') ? img.urlbase : `https://www.bing.com${img.urlbase}`
      }));
    }

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

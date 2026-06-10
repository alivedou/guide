/**
 * @fileoverview
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * fetch-metadata.js - 魔杖元数据抓取
 * 路由: GET /api/proxy/fetch-metadata?url=
 * 用途: 抓取目标网页的标题、描述、图标
 * ==========================================
 */

/**
 * 纯 JS HTML 元数据提取器（无需外部依赖，兼容 Cloudflare Workers 运行时）
 */
function extractMetadata(html, baseUrl) {
  let title = '';
  let desc = '';
  let icon = '/favicon.ico';

  // 提取 <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  // 提取 <meta name="description">
  const descMatch1 = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i);
  const descMatch2 = html.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i);
  if (descMatch1) desc = descMatch1[1];
  else if (descMatch2) desc = descMatch2[1];

  // OG 兜底
  if (!title) {
    const ogTitle = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i);
    if (ogTitle) title = ogTitle[1].trim();
  }
  if (!desc) {
    const ogDesc = html.match(/<meta[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i);
    if (ogDesc) desc = ogDesc[1];
  }

  // 提取 favicon / icon link
  const iconMatch1 = html.match(/<link[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*>/i);
  const iconMatch2 = html.match(/<link[^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i);
  const appleIcon = html.match(/<link[^>]*rel\s*=\s*["']apple-touch-icon["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*>/i);
  if (iconMatch1) icon = iconMatch1[1];
  else if (iconMatch2) icon = iconMatch2[1];
  else if (appleIcon) icon = appleIcon[1];

  // 相对路径转绝对路径
  if (icon && !icon.startsWith('http') && !icon.startsWith('//')) {
    try {
      const resolved = new URL(icon, baseUrl);
      icon = resolved.href;
    } catch (_) {
      // 保持原样
    }
  } else if (icon && icon.startsWith('//')) {
    icon = 'https:' + icon;
  }

  return { title, desc, icon };
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`[MagicWand] Fetching metadata for: ${targetUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const metadata = extractMetadata(html, targetUrl);

    return new Response(JSON.stringify({
      success: true,
      data: {
        title: metadata.title,
        desc: metadata.desc,
        icon: metadata.icon
      }
    }), {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8'
      }
    });
  } catch (err) {
    console.error('[MagicWand] Error:', err.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch metadata: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

import * as jose from 'jose';

export async function onRequestGet(context) {
  const { env } = context;
  const configStr = await env.nav.get("system:site_config");
  const config = configStr ? JSON.parse(configStr) : {
    siteTitle: "CloudNav 导航",
    faviconUrl: "/favicon.ico",
    seoKeywords: "导航, 自定义, 云端存储",
    seoDescription: "极致简洁的个人自定义导航网站"
  };
  return new Response(JSON.stringify(config), { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const admin = data.user;
  
  // 已经在中间件校验了 admin/super_user 权限
  try {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const config = await request.json();
    await env.nav.put("system:site_config", JSON.stringify(config));
    
    // 审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)')
      .bind(admin.id, 'UPDATE_SITE_CONFIG', JSON.stringify(config))
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

import * as jose from 'jose';

/**
 * 权限中心中间件
 * 负责解析 JWT 并进行初步的角色检查
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. 设置默认用户上下文
  context.data.user = { role: 'guest', id: null };

  // 2. 排除无需验证的路径 (登录、注册、公开 API)
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/bing',
    '/api/config',
    '/api/announcements'
  ];
  
  const isPublic = publicPaths.some(p => path === p);

  // 3. 解析 Token
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
      const { payload } = await jose.jwtVerify(token, secret);
      
      // 检查用户状态
      const user = await env.DB.prepare('SELECT id, username, role, status, uid, has_invite FROM users WHERE id = ?').bind(payload.id).first();
      
      if (user) {
        if (user.status === 'frozen') {
          return new Response(JSON.stringify({ error: "Forbidden", message: "您的账号已被封禁" }), { status: 403 });
        }
        
        // 注入用户信息
        context.data.user = {
          id: user.id,
          username: user.username,
          role: user.role || 'user',
          uid: user.uid,
          hasInvite: !!user.has_invite
        };
      }
    } catch (e) {
      // Token 无效且不是公开路径，则拦截
      if (!isPublic) {
        return new Response(JSON.stringify({ error: "Unauthorized", message: "登录已过期或无效" }), { status: 401 });
      }
    }
  }

  // 4. 强制校验逻辑 (RBAC)
  
  // 管理员接口校验
  if (path.startsWith('/api/admin/')) {
    const role = context.data.user.role;
    if (role !== 'admin' && role !== 'super_user') {
      return new Response(JSON.stringify({ error: "Forbidden", message: "您没有权限执行此操作" }), { status: 403 });
    }
  }

  // 非公开路径且未登录
  if (!isPublic && !context.data.user.id && !path.startsWith('/api/auth/')) {
     // 注意：这里需要排除注册/登录等路径，已经在 isPublic 处理
     if (!isPublic) {
        // 如果不是公开路径，且没有 id，说明未登录
        return new Response(JSON.stringify({ error: "Unauthorized", message: "请先登录" }), { status: 401 });
     }
  }

  return await next();
}

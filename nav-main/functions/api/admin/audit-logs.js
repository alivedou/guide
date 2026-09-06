/**
 * @fileoverview
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

export async function onRequestGet(context) {
  const { env, data, request } = context;
  const user = data.user;

  // 审计日志仅限 Admin 查看
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({
      error: "Forbidden",
      message: "权限不足：只有系统管理员可以查看审计日志"
    }), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const keyword = searchParams.get('keyword') || '';
  const actionType = searchParams.get('actionType') || '';

  try {
    let query = `
      SELECT al.*, u.username as operator_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (keyword) {
      const kw = `%${keyword}%`;
      query += ' AND (u.username LIKE ? OR al.details LIKE ? OR al.ip LIKE ?)';
      countQuery += ' AND (u.username LIKE ? OR al.details LIKE ? OR al.ip LIKE ?)';
      params.push(kw, kw, kw);
    }

    if (actionType) {
      query += ' AND al.action = ?';
      countQuery += ' AND al.action = ?';
      params.push(actionType);
    }

    // 获取总数
    const totalRow = await env.DB.prepare(countQuery).bind(...params).first();
    const total = totalRow ? totalRow.total : 0;

    // 分页
    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    const finalParams = [...params, pageSize, (page - 1) * pageSize];

    const { results } = await env.DB.prepare(query).bind(...finalParams).all();

    return new Response(JSON.stringify({
      success: true,
      logs: results,
      pagination: { total, page, pageSize }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

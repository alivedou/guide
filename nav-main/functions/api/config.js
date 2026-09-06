/**
 * @fileoverview
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * config.js — Cloudflare Pages 薄适配器
 * 路由: /api/config
 * 领域逻辑在 ../../shared/config-core.js；KV 键名在 ./_cf-storage.js
 */

import { readConfig, saveConfig, resetConfig } from '../../shared/config-core.js';
import { createCfStoragePort } from './_cf-storage.js';

const jsonHeaders = {
  'Content-Type': 'application/json;charset=UTF-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function portFor(context) {
  return createCfStoragePort(context.env, (p) => context.waitUntil(p));
}

export async function onRequestGet(context) {
  try {
    const body = await readConfig(portFor(context), context.data.user);
    return new Response(JSON.stringify(body), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'GET_ERROR', message: err.toString() }), {
      status: 500,
      headers: jsonHeaders
    });
  }
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const result = await saveConfig(portFor(context), context.data.user, payload);
    if (!result.ok) {
      const status = result.status || 500;
      const body =
        status === 401
          ? { error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' }
          : { error: result.error, code: result.code, message: result.error };
      return new Response(JSON.stringify(body), { status });
    }
    return new Response(
      JSON.stringify({
        success: true,
        categories: result.remapped.categories,
        items: result.remapped.items
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'POST_ERROR', message: err.toString() }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const result = await resetConfig(portFor(context), context.data.user);
    if (!result.ok) {
      const status = result.status || 500;
      const body =
        status === 401
          ? { error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' }
          : { error: 'DELETE_ERROR', message: result.error };
      return new Response(JSON.stringify(body), { status });
    }
    return new Response(JSON.stringify({ success: true, message: '已重置为默认配置' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'DELETE_ERROR', message: err.toString() }), { status: 500 });
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  if (method === 'DELETE') return onRequestDelete(context);
  if (method === 'OPTIONS') return onRequestOptions(context);
  return new Response(null, { status: 405 });
}

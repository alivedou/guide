# CF-nav 测试报告

时间: 2026-07-15T02:03:42Z
环境: Docker `ikun-navigation` → `http://127.0.0.1:3000`
依据: adou `testing-checklist.md` 映射到 CF-nav 实际能力

## 结果总表

| ID | 结果 | 说明 |
|----|------|------|
| D-1 容器运行 | ✅ PASS | Up |
| D-2 首页 | ✅ PASS | 200 |
| D-3 search-ux 部署 | ✅ PASS | 引用+autofocus+200 |
| D-4 Volume | ✅ PASS | local_kv 挂载 |
| D-5 启动日志 | ✅ PASS | OK |
| D-6 Dockerfile 无密钥 | ✅ PASS | 未内置生产密钥 |
| A-1 游客 config | ✅ PASS | 200 |
| A-2 匿名写 config | ✅ PASS | 拒绝 401 |
| A-3 空登录体 | ❌ FAIL | HTTP 000 |
| A-4 注册 | ✅ PASS | tadou1023 |
| A-5 登录 | ✅ PASS | token ok |
| A-6 鉴权读 config | ✅ PASS | 200 |
| A-7 鉴权写 config | ✅ PASS | 200 |
| A-8 错误密码 | ✅ PASS | 401 |
| A-9 连续5次读 | ✅ PASS | 均200 |
| A-10 bing | ✅ PASS | 200 |
| A-11 公告 | ✅ PASS | 200 |
| A-12 管理匿名 | ✅ PASS | 403 |
| D-7 重启后数据仍在 | ✅ PASS | 用户可登录 |
| D-8 数据目录 | ✅ PASS | 3 文件 |
| F-1 escapeHTML | ✅ PASS | 有 |
| F-2 搜索修复 | ✅ PASS | 特征齐全 |
| S-1 文档与SQL布局 | ✅ PASS | AGENTS+sql+migrations |
| S-2 核心表存在 | ✅ PASS | announcement_read_states,announcements,audit_logs,categories,invitation_codes,items,sqlite_sequence,user_settings,users |
| C-1 测试凭据 | ✅ PASS | 非扫描格式 |
| D-9 /health | ✅ PASS | 200 |

## 汇总: PASS=25 FAIL=1 SKIP=0

**结论: 1 项失败，见上表。**

## adou 清单映射

| adou | 本测 | 适用性 |
|------|------|--------|
| T-5/6/18 容器持久化 | D-1,D-4,D-7,D-8 | ✅ 已测 |
| T-8 高频 | A-9 | ✅ 已测 |
| T-17 空值 | A-3 | ✅ 已测 |
| T-28 匿名写 | A-2,A-12 | ✅ 已测 |
| T-30 假token | C-1 | ✅ 已测 |
| 镜像无密钥 | D-6 | ✅ 已测 |
| 搜索体验修复 | D-3,F-2 | ✅ 已测 |
| 注册登录闭环 | A-4~A-8 | ✅ 已测 |
| T-1 HTTPS域名 / T-23 博客 / T-20 TG | — | ⏭️ 本环境不适用 |

测试用户: `tadou1023`（仅测试环境）

## 回归（登录空参修复后）

| ID | 结果 | 说明 |
|----|------|------|
| A-3 空登录体 `{}` | ✅ PASS | HTTP 400 + 进程不崩 |
| 缺 password | ✅ PASS | HTTP 400 |
| 正常登录 | ✅ PASS | 200 + token |
| 容器 RestartCount | ✅ | 0 |

修复：`server.js` + `nav-main/functions/api/auth/login.js` 入参校验 + try/catch。

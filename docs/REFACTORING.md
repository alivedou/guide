# CF-nav v4 结构诊断与重构方案

对象仓库：https://github.com/alivedou/CF-nav  
基线分支：`v4`  
原则：**功能全部保留，双部署保留，不换成 React。** 乱的根源是业务写了两遍和几个上帝文件，不是缺框架。

本文可以整份拷进 CF-nav 仓库，作为后续增量重构的施工单。每阶段可独立合并；**阶段测试没绿，不准进下一阶段。** 测试目录、用例表和验收勾选见 [TESTING.md](./TESTING.md)。

---

## 1. 结论

v4 已经能跑：Cloudflare Pages + KV + D1，以及 VPS Docker + SQLite。前端是无打包 Vanilla JS。这套运行契约不要动。

结构乱，是因为：

1. 同一套 `/api/*` 在 `server.js` 和 `nav-main/functions/api/*` 各写一遍。
2. `app.js`（4388 行）、`server.js`（1968 行）、`style.css`（5739 行）成了只能往尾部追加的上帝文件。
3. 表结构有 migrations + 三份 sql + 两份运行时热补丁。
4. `nav-main/` 是 Cloudflare Pages 的构建根，不是领域边界；根目录还堆着失效配置。

重构策略：**抽出 `nav-main/shared` 领域层 + 按功能拆文件 + 两端薄适配器。**  
不要：Next/React 重写导航站、改 Pages Root、统一 KV 键名、挪 `ikun.sh`。

---

## 2. 现状（实读 v4）

```
CF-nav/
├── server.js                    # Node 唯一入口，全部 API
├── package.json / Dockerfile / ikun.sh
├── wrangler.toml                # Pages Root=nav-main 时不生效
├── eslint.config.js             # 现行 lint
├── .eslintrc.json / metadata.json   # 残留
├── migrations/0000_init.sql     # 运行时权威表结构
├── sql/schema*.sql              # 给人看，靠人手对齐
└── nav-main/                    # ★ CF Pages 构建根
    ├── public/                  # 静态前端
    └── functions/api/           # 文件即路由；defaultData.js 已被 server import
```

两端数据落点不同，这是功能不是乱：

| 数据 | D1 / SQLite | KV / local_kv | 浏览器 |
|------|-------------|---------------|--------|
| 用户、配额、邀请、公告、审计 | 权威 | — | — |
| 分类 / 书签 / 偏好 | 双写 | GET 优先读这里 | `nav_app_data` |
| 站点配置 | — | `system:site_config` 或 `site_config.json` | — |
| 大图背景 | — | — | IndexedDB |

CF KV 键是 `user_config:<uuid>`，Docker 文件是 `local_kv/user_<uuid>.json`。不要为了好看去统一，除非单独做迁移。

---

## 3. 乱点

| 严重度 | 问题 | 位置 |
|--------|------|------|
| 高 | 配额、鉴权、告警、schema 补丁、id 重映射双份拷贝；`site-config` 在 server.js 注册了两套 | `server.js` ↔ `functions/api` |
| 高 | 上帝文件 | `app.js` / `server.js` / `style.css` / `index.html` |
| 高 | 改一列要动 migrations、三份 sql、两份热补丁 | `migrations` / `sql` / `_d1_schema_patch.js` |
| 中 | 共享代码若放到仓库根，Pages 构建读不到 | Pages Root = `nav-main` |
| 中 | 模块靠 `window.*` 和脚本顺序粘合；`search-ux.js` 必须最后加载 | `public/assets/js` |
| 低 | README 仍提 TOKEN/kv_mock；双份 eslint；metadata.json | 根目录 / docs |

`defaultData.js` 已经是正确模式：放在 `nav-main/functions/api/`，`server.js` 直接 import。共享层应沿这条路扩大，而不是新建一套根目录 `packages/`（Pages 看不见）。

---

## 4. 目标结构

```
CF-nav/
├── ikun.sh                      # 路径不变
├── Dockerfile                   # COPY 增加 src/
├── src/server/                  # Express：启动 + 路由
│   ├── index.js
│   ├── db.js / kv-fs.js
│   └── routes/*
├── nav-main/                    # Pages Root 不变
│   ├── shared/                  # ★ 两端共同领域层
│   │   ├── quota.js
│   │   ├── default-data.js
│   │   ├── schema-patch.js
│   │   ├── time.js
│   │   ├── alerts.js
│   │   ├── ids.js
│   │   └── handlers/            # 阶段 3 再放用例
│   ├── functions/api/           # 薄适配器
│   └── public/assets/
│       ├── css/{tokens,layout,sidebar,cards,modals,admin}.css
│       └── js/{main.js, core/, features/}
├── migrations/                  # 仍是运行时权威
└── sql/                         # 从权威源生成或同源，不再手抄四份
```

### 文件搬家

| 现在 | 搬到 |
|------|------|
| `server.js` | `src/server/*` + `nav-main/shared/*` |
| `defaultData.js` | `nav-main/shared/default-data.js` |
| `QUOTA_CONFIG` × 2 | `nav-main/shared/quota.js` |
| 两份 schema 热补丁 | `nav-main/shared/schema-patch.js` |
| `app.js` | `public/assets/js/features/{boot,auth,render,search,...}` |
| `search-ux.js` | 并进 `features/search` |
| `style.css` | 多文件 CSS，index 里按序 link |
| `.eslintrc.json` / `metadata.json` | 删除 |

`getQuota` 的 `has_invite` 查询由适配器注入，不要让 shared 依赖 `better-sqlite3` 或 `env.DB`。

---

## 5. 阶段计划

**先做阶段 B（冻结基线），再动 0–6。** 每个阶段的测试文件、用例表、验收勾选见 [TESTING.md](./TESTING.md)。下面补上过线条件。

### 阶段 B · 基线（改代码之前）

在 CF-nav 增加 `tests/`，对当前 v4 打 HTTP 快照。`npm run test:capture` 提交 `fixtures/baseline/`。没有快照不准改业务。

### 阶段 0 · 卫生清理（风险极低）

- 删 `metadata.json`、根 `.eslintrc.json`。
- 删 `server.js` 里后注册的那套 `/api/admin/site-config`。
- 标明根 `wrangler.toml` 不被 Pages 读取。
- README 以 `JWT_SECRET` + `local_kv/` 为准，去掉 TOKEN / kv_mock。
- 过时 docs 顶部注明「以 AGENTS.md 与代码为准」。

完成标准：本地 `npm run dev` 与 Docker 构建行为不变。  
测试：`tests/phase0/hygiene.test.mjs` + baseline。过线：`test:phase0` 与 `test:baseline` 全绿；diff 不含业务逻辑。

### 阶段 1 · 共享领域层（风险低）

- 建 `nav-main/shared/`，先搬默认数据，再搬配额、时间、PATCH_SQL、告警报文。
- `server.js` 与 Functions 改为 import，删除拷贝。
- Dockerfile 已 COPY `nav-main/`，不必改白名单。

完成标准：改 `shared/quota.js` 一处，Node 与 wrangler preview 配额同时变。  
测试：`tests/unit/quota.test.mjs` 等 + `no-duplicate-source.test.mjs`。过线：配额只剩一份源；超限两端同时拒绝。

### 阶段 2 · 拆 server.js（风险低）

- `src/server/index.js` 只做启动与 static。
- 路由按现有 `/api` 分组。
- `package.json` `main` 与 Dockerfile `COPY src/` 跟上。

完成标准：`server.js` 消失或只剩 re-export；注册 / 登录 / 保存书签 / 导入导出与拆前一致。  
测试：`route-map.test.mjs`、`docker-copy.test.mjs` + baseline。过线：路由表对齐；契约零 diff；镜像能 build。

### 阶段 3 · Functions 薄适配器（风险中）

- 定义最小 `StoragePort`：`kv.get/put/delete`、`db.prepare`、`waitUntil`、密钥。
- 先迁 `/api/config`（配额 + id 重映射最肥），再迁登录和后台。
- **不要**统一 CF 与 Node 的 KV 键名。
- **不要**去掉 POST `/api/config` 的 id 重映射。

完成标准：保存书签的 id 重映射只存在于 shared。  
测试：`ids.test.mjs`、`dual-runtime.test.mjs`。过线：`test:dual` 全绿；KV 键名保持两端旧约定。

### 阶段 4 · 前端按功能拆（风险中）

- `<script type="module" src="/assets/js/main.js">`。
- 按现有函数块切：boot、auth、render、search、sidebar、zen、notices、profile、idb-bg。
- 第一轮继续 `Object.assign(window, …)`，保证 inline onclick。
- 合并 `search-ux.js`。`user-manage.js` 按 Tab 拆。
- **升高** `ServiceWorker.js` 的 `CACHE_NAME`。

完成标准：搜索首字符、禅意、拖拽、后台四个 Tab 与现在相同。  
测试：Playwright smoke/search/admin + `module-boot.test.mjs`。过线：首字符与引擎刷新不回归；CACHE_NAME 已升高。

### 阶段 5 · CSS / HTML 减负（风险中）

- CSS 按 tokens / layout / sidebar / cards / search / modals / admin / responsive 切开。
- 不要用深层 `@import`。快捷键指南去掉 inline style。
- 不给导航站上 Tailwind。

测试：`css-order.test.mjs` + 视觉/响应式 E2E。过线：tokens 先加载；主题截图 diff < 0.3% 或有说明的基线更新。

### 阶段 6 · SQL 单一权威（风险中）

- PATCH 列表只维护一份。
- `schema.upgrade.sql` 同源生成。
- 改表 PR 必须同时改 `migrations/0000_init.sql`。
- 不要把 `sql/` 拷进 Docker，不要 DROP 用户表。

测试：`tests/phase6/*.test.mjs` + 旧库 fixture。过线：CREATE/ALTER 集合对齐；缺列旧库能自愈；Dockerfile 不 COPY `sql/`。

---

## 6. 不能动的契约

- Pages：Root = `nav-main`，输出 `public`，KV 绑定 `nav`，D1 绑定 `DB`，`JWT_SECRET` 必需。
- `ikun.sh` 留在仓库根（raw URL）。
- 镜像 `ghcr.io/alivedou/ikun_nav`，容器 `ikun-navigation`，数据卷 `/app/local_kv`。
- API 路径与 JSON 语义保持对等（见下一节）。
- 大图背景继续走 IndexedDB，不要改成走 API（Workers 体积限制）。

---

## 7. API 对等表（路径不能变）

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET|POST|DELETE /api/config`
- `GET /api/bing`
- `GET /api/proxy/fetch-metadata`
- `GET /api/share`
- `GET /api/announcements` + `POST .../read`
- `GET|POST /api/user/profile`
- `GET|POST /api/admin/site-config`
- `GET|PATCH|DELETE /api/admin/users`
- `GET|POST|DELETE /api/admin/invitations`
- `GET|POST|PATCH|DELETE /api/admin/announcements`
- `GET /api/admin/audit-logs`
- `GET /api/admin/cron-digest`

---

## 8. 每阶段回归清单

自动化先跑：`test:baseline`（以及该阶段的 `test:phaseN`）。下列为机器覆盖不到、仍需点一次的项：

- [ ] 打开首页，无闪烁、无裂图
- [ ] 首位注册成为 admin
- [ ] 登录 / 登出
- [ ] 搜索：引擎选择刷新后仍在；键入不丢首字符
- [ ] 加分类、加书签、拖拽排序、魔棒抓图标
- [ ] 云同步、导入导出（id 被重映射、不带身份字段）
- [ ] 禅意模式、侧边栏钉住、移动端抽屉
- [ ] 后台：用户 / 邀请 / 公告 / 审计
- [ ] Docker：数据写在挂载的 `/app/local_kv`，重启不丢

测试项目细节、双运行时对比、旧库 fixture 见 [TESTING.md](./TESTING.md)。

---

## 9. 建议开工顺序

1. 阶段 B：在 CF-nav 加上 `tests/`，冻结基线。
2. 阶段 0 + 1，测试跟着合（配额单测是硬门槛）。
3. 阶段 2：路由表 + 契约零 diff；Dockerfile COPY 要测。
4. 阶段 3 用 `/api/config` 试点，强制 `test:dual`。
5. 前端拆分必须带 Playwright；搜索首字符是历史回归点。

不要把导航站迁到其它框架仓库。本方案仓库里的 Next.js 页面只是说明书。

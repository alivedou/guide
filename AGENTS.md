# AGENTS.md — CF-nav 维护手册

给后续的人（和 AI）用：改代码前先读本文，避免踩 Docker / Cloudflare 双部署坑。

- **仓库**：https://github.com/alivedou/CF-nav
- **主分支 / 生产分支**：`v4`
- **本地目录名**可能是 `CF-nav-multiple-v4`，仓库名仍是 `CF-nav`，不要按文件夹名改对外 URL。
- **作者习惯**：增量开发、不乱动旧结构、不擅自重构、交付前自测。

历史分支 `v1-single` / `v2-multiple` / `v3-fix` 只作演进记录，**不要**往 `v4` 合、也不要以它们为改代码基线。

---

## 1. 项目是什么

多用户高颜值导航站（文档里也叫 CloudNav / IKUN 导航）。两套运行形态共用同一套前端 + 近同构 API：

| 形态 | 入口 | 存储 | 典型部署 |
|------|------|------|----------|
| **VPS / Docker** | 根目录 `server.js`（Express + better-sqlite3） | SQLite（`DB_PATH`，Docker 默认 `/app/local_kv/local_d1.db`）+ `local_kv/` JSON 模拟 KV | `ikun.sh` / `Dockerfile` → `ghcr.io/alivedou/ikun_nav` |
| **Cloudflare Pages** | `nav-main/public` + `nav-main/functions` | Workers KV（binding **`nav`**）+ D1（binding **`DB`**） | Git 连 Pages，Root directory = **`nav-main`** |

前端：Vanilla JS，**无打包构建**。改 `nav-main/public` 即生效（Docker 需重建镜像）。

Node 运行时：**22 LTS**（Dockerfile 与 GitHub Actions 已对齐）。

首位注册用户自动成为 `admin`。旧单用户 `TOKEN` / `kv_mock.json` 已废弃，`.env.example` 里的 `TOKEN=` 可忽略。

---

## 2. 目录结构（改之前先看）

```text
CF-nav/
├── AGENTS.md                 # 本文件（给维护者 / AI）
├── README.md                 # 用户部署手册（对外）
├── LICENSE
├── package.json              # 根 npm：dev/start/preview/Docker 依赖
├── server.js                 # ★ VPS / 本地 Node 唯一运行时入口（大文件，勿拆）
├── Dockerfile                # ★ Node 22 多阶段；只 COPY 见 §3
├── ikun.sh                   # ★ 一键脚本；GitHub raw URL 挂在仓库根，勿挪路径
├── wrangler.toml             # 根目录 wrangler（Pages Root=nav-main 时不生效）
├── wrangler.toml.example     # 含 KV/D1 binding 示例
├── .env.example
├── eslint.config.js          # 现行 ESLint flat config（npm run lint 用这个）
├── .eslintrc.json            # 旧配置残留，勿当权威
├── metadata.json             # 非运行时残留，勿当入口
├── migrations/               # ★ 运行时 DB 权威迁移（进 Docker）
│   └── 0000_init.sql
├── sql/                      # 给人看的 SQL（不进 Docker）
│   ├── README.md
│   ├── schema.sql
│   ├── schema.console.sql
│   └── schema.upgrade.sql
├── nav-main/                 # ★ CF Pages 项目根（控制台 Root directory = nav-main）
│   ├── wrangler.toml         # Pages 侧 nodejs_compat（jose）
│   ├── package.json          # Pages 构建 npm install（jose）
│   ├── public/               # 静态资源 + 前端
│   │   ├── index.html        # 脚本加载顺序见 §6
│   │   ├── manifest.json     # PWA
│   │   ├── ServiceWorker.js  # 缓存版本号 CACHE_NAME，改静态缓存策略时要升版本
│   │   └── assets/
│   │       ├── css/style.css
│   │       └── js/           # 见 §6 模块表
│   └── functions/api/        # Pages Functions（与 server 路由近同构）
│       ├── _middleware.js    # JWT + 缺列补丁 waitUntil + 异常告警
│       ├── _d1_schema_patch.js
│       ├── defaultData.js    # ★ 默认分类/书签模板（server.js 也 import 这里）
│       ├── config.js         # GET/POST/DELETE /api/config
│       ├── bing.js / share.js / announcements.js
│       ├── auth/ login.js register.js
│       ├── user/ profile.js
│       ├── proxy/ fetch-metadata.js
│       └── admin/            # users / site-config / invitations / announcements / audit-logs / cron-digest
├── docs/                     # 部署/需求等长文档（不进 Docker）
├── tests/                    # 基线契约与分阶段卫生测试
└── .github/workflows/
    └── docker-publish.yml    # 手动 workflow_dispatch 推 GHCR；默认 latest
```

### 根目录「别乱动」清单

| 路径 | 原因 |
|------|------|
| `server.js` / `Dockerfile` / `package.json` | Docker 与本地 `npm run dev` |
| `migrations/` | server 自愈 + wrangler migrate |
| `nav-main/` | CF 构建根；前端与 Functions 都在这 |
| `ikun.sh` | README 一键 URL：`https://raw.githubusercontent.com/alivedou/CF-nav/v4/ikun.sh` |
| `README.md` / `LICENSE` | 门面 |

### 可以收纳、但已约定位置

| 路径 | 说明 |
|------|------|
| `sql/*` | 控制台/升级 SQL，**不进镜像** |
| `docs/*` | 部署/需求等长文档，**不进镜像** |
| `local_kv/`、`local_d1.db`、`.env`、`.wrangler/` | 本地运行时产物，已 gitignore |

---

## 3. Docker 白名单（打包会不会乱）

`Dockerfile` **实际只复制**：

```text
package*.json → npm ci --omit=dev
server.js
migrations/
nav-main/
```

基础镜像 `node:22-slim`。容器内：

- 端口 `PORT`（默认 3000）
- 数据卷 **`/app/local_kv`**（SQLite + KV JSON 都在这）
- `DB_PATH=/app/local_kv/local_d1.db`

因此：

- 改 `sql/`、`docs/`、`README.md`、`ikun.sh` **不会**自动进镜像（脚本仍从 GitHub 拉）。
- 前端/边缘逻辑要生效 → 必须改 `nav-main/` 后 **重新 build 镜像**。
- 表结构要生效 → 改 **`migrations/`** 后重建镜像；已有数据卷不会因 `CREATE IF NOT EXISTS` 自动加列（见 §5）。

本地验证示例：

```bash
docker build -t ikun-nav:local-test .
docker rm -f ikun-navigation
docker run -d --name ikun-navigation -p 3000:3000 \
  --env-file /opt/my-nav/.env \
  -v /opt/my-nav/local_kv_data:/app/local_kv \
  --restart always ikun-nav:local-test
```

一键脚本默认拉 **`ghcr.io/alivedou/ikun_nav:latest`**，容器名 `ikun-navigation`，宿主机目录 `/opt/my-nav`。源码改完要给用户用上：走 GitHub Actions（`workflow_dispatch`，可填 version tag）发布镜像，或让用户装本地 build 的 tag。

---

## 4. Cloudflare 部署要点（易错）

推荐顺序：

1. 建 KV + D1（库名习惯 `cloudnav-db`）
2. **初始化 D1 表**（`sql/schema.console.sql`；老库再跑 `sql/schema.upgrade.sql`）
3. 连 Git 建 Pages
4. 绑定 + 环境变量
5. Redeploy

| 项 | 必须值 |
|----|--------|
| 生产分支 | `v4` |
| Root directory | **`nav-main`** |
| Build command | `npm install` |
| Build output | **`public`** |
| KV binding 名 | **`nav`** |
| D1 binding 名 | **`DB`** |
| 环境变量 | **`JWT_SECRET` 必需**；`CRON_SECRET` / `TELEGRAM_*` / `RESEND_*` 可选 |

`nav-main/wrangler.toml` 含 `nodejs_compat`（jose）。根目录 `wrangler.toml` 在 Root=`nav-main` 时**不会**被 Pages 使用。

边缘侧老库缺列：`_d1_schema_patch.js` 在 `_middleware.js` 每个 isolate 首次请求时 `waitUntil` 补丁一次。仍建议控制台跑 `sql/schema.upgrade.sql` 更稳。

**Functions 文件即路由**：`nav-main/functions/api/` 下普通 `.js` 会变成 `/api/...`。共享 helper 用 `_` 前缀（`_middleware.js`、`_d1_schema_patch.js`）。`defaultData.js` 是被 import 的模板，不要再往这里加无 `onRequest*` 的业务文件。

---

## 5. 数据库与数据落点

### 权威 SQL 源

| 文件 | 角色 |
|------|------|
| **`migrations/0000_init.sql`** | **唯一运行时权威**（Docker + server 自愈 + wrangler migrate） |
| `sql/schema.sql` | 给人看的完整结构，**正文应与 0000 对齐** |
| `sql/schema.console.sql` | CF 控制台粘贴 |
| `sql/schema.upgrade.sql` | 已有库 `ALTER` 补列（duplicate 可忽略） |

### 改表流程

1. 改 **`migrations/0000_init.sql`**（或新增 `migrations/000x_*.sql`）。
2. 同步 **`sql/schema.sql`**。
3. 视情况更新 `schema.console.sql` / `schema.upgrade.sql`，并给 `_d1_schema_patch.js` 与 `server.js` 热补丁补同一列。
4. **切记**：`CREATE TABLE IF NOT EXISTS` **不会**给旧表加列。

### 数据到底在哪（不要假设「全在 SQL」）

| 数据类型 | D1 / SQLite | KV（CF `nav` / 本地 `local_kv/`） | 浏览器 |
|----------|-------------|-----------------------------------|--------|
| 用户、配额、邀请、公告、审计、分享 slug | **权威** | — | — |
| 分类 / 书签 / 偏好 settings | **双写**（POST `/api/config` 会 DELETE+INSERT 并重映射 id） | JSON 文档，**GET 优先读这里** | `localStorage.nav_app_data` |
| 站点级配置（注册开关、品牌等） | — | CF：`system:site_config`；Node：`site_config.json` | — |
| 大图背景 | — | — | IndexedDB `nav_local_db`（老值从 `nav_local_bg_image` 迁移） |
| 搜索引擎选择 | — | 云端 settings 不覆盖本地 | `nav_search_engine` / `nav_search_prefix` |

默认分类模板：`nav-main/functions/api/defaultData.js`（**server.js 直接 import 同一文件**）。改默认书签只改这一处。

### KV 键名两边不一样（改存储时必须对齐）

| 用途 | Cloudflare KV | Docker / `server.js` 文件 |
|------|----------------|---------------------------|
| 某用户导航 JSON | `user_config:<uuid>` | `local_kv/user_<uuid>.json` |
| 站点配置 | `system:site_config` | `local_kv/site_config.json` |
| 访客默认配置 | `config` | 内存里的 `defaultData` |

不要把 CF 的键名套到 Node 文件名上（或反过来），除非两边一起改。

### 双运行时差异

| | Docker `server.js` | CF Functions |
|--|-------------------|--------------|
| 建表 | 启动读 `migrations/` + PRAGMA 热补丁 | 人工/SQL 控制台 + `_d1_schema_patch.js` |
| 业务数据 | SQLite 表 + `local_kv/*.json` | D1 表 + KV JSON |
| 静态资源 | `express.static(nav-main/public)` | Pages `public/` |
| JSON 体大小 | `express.json({ limit: '10mb' })` | Workers 默认限制更严，大图不要走 API |

`categories.id` / `items.id` 在 SQL 里是**全局主键**。保存/导入必须重映射 id（`config.js` 与 `server.js` POST `/api/config` 已做；前端 `import-export-sanitize.js` 导出时去掉身份字段、导入时换新 id）。不要为了「保留原 id」去掉这段。

### 角色与配额（改配额时 Functions 与 server 各有一份 `QUOTA_CONFIG`）

| 角色 | 分类上限 | 每分类书签 |
|------|----------|------------|
| guest | 6 | 12 |
| user | 12 | 25 |
| invited_user（`has_invite`） | 15 | 30 |
| super_user | 20 | 40 |
| admin | 150 | 500 |

鉴权：JWT（`jose`）+ `Authorization: Bearer`。无 token / 无效 token 降为 guest，不直接 401（部分写接口再 401）。`adminOnly`：`admin` 或 `super_user`；部分站点级操作仅 `admin`。

---

## 6. 前端约定

无 React/Vue 构建链。`index.html` 脚本顺序（后加载可覆盖前者挂到 `window` 的函数）：

| 文件 | 职责 |
|------|------|
| `utils.js` | 防抖、HTML 转义等 |
| `colorExtractor.js` | 图标主色 → 卡片毛玻璃底色 |
| `emoji-pool.js` | Emoji 选图标 |
| `theme-mode.js` | 亮/暗/跟随系统 |
| `personalization.js` | 视觉实验室（密度、背景、毛玻璃） |
| `cloud-sync.js` | 云端同步中心 UI |
| `sys-config.js` | 站点品牌 / 注册策略 / 角色授权 |
| `user-manage.js` | 用户、邀请、公告、审计后台 |
| `import-export-sanitize.js` | 导入导出清洗（去身份字段、换 id） |
| `page-manage.js` | 分类/书签 CRUD、拖拽、魔棒抓图标 |
| `app.js` | **主业务**（渲染、登录、搜索、公告、键盘、IndexedDB 背景） |
| `search-ux.js` | 增量补丁：引擎 localStorage 优先、首字符保留、best-effort 聚焦 |

原则：

- **能新增模块就新增**；少改巨型 `app.js` / `server.js`；禁止无必要重构。
- 浏览器地址栏焦点无法被网页抢走；omnibox 聚焦时做不到「开浏览器就键入进导航搜索」。
- 改 PWA 缓存逻辑时升 `ServiceWorker.js` 里的 `CACHE_NAME`。

本地偏好键示例：`nav_token`、`nav_current_user`、`nav_app_data`、`nav_search_engine`、`nav_search_prefix`、`nav_sidebar_pinned`、`nav_theme_mode`、`nav_clicks_history`、`nav_last_cloud_sync`。

---

## 7. API 与权限

路径统一 `/api/*`。改接口时 **Functions 与 `server.js` 都要看**。

| 路径 | 说明 |
|------|------|
| `POST /api/auth/register` | 首位用户 → admin；可邀请码 |
| `POST /api/auth/login` | 登录防爆破 |
| `GET/POST/DELETE /api/config` | 导航 JSON；写操作会配额校验 + id 重映射 |
| `GET /api/bing` | 每日壁纸 |
| `GET /api/proxy/fetch-metadata` | 魔棒抓标题/图标（需登录） |
| `GET /api/share?slug=` | 公开只读分享页 |
| `GET /api/announcements` + `POST .../read` | 用户侧公告 |
| `GET/POST /api/user/profile` | 资料、邮箱、TG、临时密码 |
| `GET /api/admin/site-config` | 站点配置（读可匿名） |
| `POST /api/admin/site-config` | 仅 admin |
| `GET/PATCH/DELETE /api/admin/users` | 用户治理 |
| `GET/POST/DELETE /api/admin/invitations` | 邀请码 |
| `GET/POST/PATCH/DELETE /api/admin/announcements` | 公告后台 |
| `GET /api/admin/audit-logs` | 审计 |
| `GET /api/admin/cron-digest` | 日报；Header `x-cron-secret` 或已登录 admin |

中间件：CF `_middleware.js` / Node `authenticate`。告警走 Telegram（可多 Bot 逗号分隔）或 Resend 邮件；本地无密钥时 `server.js` 会把日报打到控制台。

`server.js` 里 `/api/admin/site-config` 目前注册了**两套**相同路由，Express 只跑先注册的那套。不要再抄第三份；若清理重复，只删后一份、保留行为。

---

## 8. 常用命令

```bash
# 本地开发（Node 模拟 D1/KV）
npm install
cp .env.example .env   # 配 JWT_SECRET；TOKEN 可空
npm run dev            # http://localhost:3000  （node --watch）

# 重构门禁（数据写在 tests/.tmp，不碰 local_d1.db）
npm run test:capture   # 重新冻结 HTTP 快照（改契约时才跑）
npm run test:baseline  # 每阶段合并前
npm run test:phase0    # 阶段 0 卫生
npm test               # baseline + phase0

# Wrangler 本地 Pages 模拟（数据在 .wrangler/，与 Node 的 local_d1.db 隔离）
npm run preview
npm run db:migrate     # 本地 D1 迁移

# 代码风格
npm run lint
npm run format
```

- `npm run clean` 用的是 Unix `rm -rf`，**Windows PowerShell 会失败**；请手动删 `local_kv/`、`local_d1.db`。
- `npm run deploy` 是 wrangler Pages deploy，不要当成 Docker 发布。

---

## 9. 改动时检查清单

- [ ] 是否破坏「根目录勿动」文件路径？
- [ ] 若改表：是否更新了 `migrations/` + `sql/` + 两端热补丁？
- [ ] 若改 API / 配额 / 默认数据：Functions **与** `server.js` 是否对称？`defaultData.js` 是否只改一处？
- [ ] 若改前端：Docker 用户是否需要 **新镜像**？PWA `CACHE_NAME` 要不要升？
- [ ] 若改 `ikun.sh`：README 里的 raw URL 是否仍有效？
- [ ] CF 相关：binding 名是否仍是 `nav` / `DB`？`JWT_SECRET` 是否文档有写？
- [ ] 导入/同步是否仍重映射分类与书签 id？
- [ ] 本地或容器上是否自测：打开首页、首位注册成 admin、登录、搜索、加书签、同步、导入导出？

---

## 10. 已知坑（排障）

| 现象 | 方向 |
|------|------|
| `no such table` | D1/SQLite 未初始化；CF 绑错库或未跑 schema |
| `no such column` | 老库缺列；跑 `sql/schema.upgrade.sql` 或等补丁 |
| 一键脚本仍是旧功能 | GHCR `latest` 未发布新镜像 |
| 搜索引擎刷新变回必应 | `search-ux.js`：localStorage 优先于云端 settings |
| 键入丢首字符 | `search-ux.js` capture + `app.js` 防双写标记 |
| Pages 有静态无 API | Root 不是 `nav-main` 或未绑 KV/D1 |
| 登录异常 | 缺 `JWT_SECRET` 或两端密钥不一致 |
| 导入/同步 500 或 UNIQUE | 分类/书签 id 全局唯一；走 sanitize + 服务端重映射，不要原样写库 |
| `npm run dev` 与 `preview` 数据对不上 | Node 用 `local_d1.db` + `local_kv/`；Wrangler 用 `.wrangler/` |
| README 写「配 TOKEN / 读 kv_mock.json」 | 过时；当前是 JWT + `local_kv/` |
| 容器重启丢数据 | 未挂载 `/app/local_kv` |
| Windows 上 `npm run clean` 失败 | 脚本是 `rm -rf`，手动删本地库文件 |

---

## 11. 给 AI 的硬约束

1. **增量开发**：优先新文件/新函数，禁止为「好看」重构 `app.js` / `server.js`。
2. **不删现有功能**，不擅自改对外 URL、binding 名（`nav` / `DB`）、`ikun.sh` 路径、镜像名 `ikun_nav`。
3. **双部署意识**：改运行时逻辑时同时改 Functions 与 `server.js`；改默认数据只改 `defaultData.js`。
4. **SQL 权威在 `migrations/`**，不要只改 `sql/` 就当修完库。
5. **不要**把 `schema*.sql` 拷进 Dockerfile「顺便」。
6. 大改前说明：修改位置、影响范围、风险；能写检查步骤就写。
7. 用户未要求时：**不擅自 git commit / push / 发布镜像**。
8. 不要「统一」CF 与 Node 的 KV 键名，除非任务就是做迁移且两边一起改。
9. 不要去掉 POST `/api/config` 的 id 重映射。

---

## 12. 相关文档

| 文档 | 用途 |
|------|------|
| `README.md` | 用户向安装（Docker 一键 + CF 步骤）。个别段落仍提 TOKEN/kv_mock，以代码为准 |
| `sql/README.md` | SQL 双份维护 |
| `docs/deployment-docker.md` | VPS / Docker 展开 |
| `docs/deployment.md` | CF / Wrangler（偏早期手写，可能过时） |
| `docs/REQUIREMENTS.md` | 历史需求/规格（可能与实现有偏差，以代码为准） |
| `docs/cloudnav-project-features.md` | 功能特性清单 |
| `docs/TESTING-REPORT.md` | 某次 Docker 实测样例 |
| `docs/README.md` | 文档目录索引 |

---

*维护时以代码与本文为准；REQUIREMENTS / 旧 README 段落与实现冲突时，先核对 `server.js` / `nav-main/functions` 再改文档。*

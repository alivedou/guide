# AGENTS.md — CF-nav 维护手册

给后续的人（和 AI）用：改代码前先读本文，避免踩 Docker / Cloudflare 双部署坑。

- **仓库**：https://github.com/alivedou/CF-nav  
- **主分支**：`v4`  
- **作者习惯**：增量开发、不乱动旧结构、不擅自重构、交付前自测  

---

## 1. 项目是什么

多用户高颜值导航站，两套运行形态共用同一套前端 + 近同构 API：

| 形态 | 入口 | 存储 | 典型部署 |
|------|------|------|----------|
| **VPS / Docker** | 根目录 `server.js` | SQLite（`local_kv` / `DB_PATH`）+ 本地 KV 模拟 | `ikun.sh` / `Dockerfile` → `ghcr.io/.../ikun_nav` |
| **Cloudflare Pages** | `nav-main/public` + `nav-main/functions` | Workers KV（binding `nav`）+ D1（binding `DB`） | Git 连 Pages，根目录设为 `nav-main` |

前端业务主逻辑在 `nav-main/public/assets/js/`（Vanilla JS，无打包构建）。

---

## 2. 目录结构（改之前先看）

```text
CF-nav/
├── AGENTS.md                 # 本文件
├── README.md                 # 用户部署手册（对外）
├── package.json              # 根 npm：dev/start/preview/Docker 依赖
├── server.js                 # ★ VPS 唯一运行时入口
├── Dockerfile                # ★ 只 COPY 见下文「Docker 白名单」
├── ikun.sh                   # ★ 一键脚本；GitHub raw URL 挂在仓库根，勿随便挪路径
├── wrangler.toml             # 本地 wrangler（根目录）
├── wrangler.toml.example
├── .env.example
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
│   │   ├── index.html
│   │   └── assets/js/
│   │       ├── app.js        # 主业务
│   │       ├── search-ux.js  # 搜索体验增量补丁
│   │       └── ...
│   └── functions/api/        # Pages Functions（与 server 路由近同构）
│       ├── _middleware.js
│       ├── _d1_schema_patch.js
│       ├── config.js
│       └── ...
├── docs/                     # 部署/需求/特性/测试报告（不进 Docker）
└── .github/workflows/        # Docker 镜像发布
```

### 根目录「别乱动」清单

| 路径 | 原因 |
|------|------|
| `server.js` / `Dockerfile` / `package.json` | Docker 与本地 dev |
| `migrations/` | server 自愈 + wrangler migrate |
| `nav-main/` | CF 构建根 |
| `ikun.sh` | README 一键 URL：`.../v4/ikun.sh` |
| `README.md` / `LICENSE` | 门面 |

### 可以收纳、但已约定位置

| 路径 | 说明 |
|------|------|
| `sql/*` | 控制台/升级 SQL，**不进镜像** |
| `docs/*` | 部署/需求等长文档，**不进镜像** |

---

## 3. Docker 白名单（打包会不会乱）

`Dockerfile` **实际只复制**：

```text
package*.json → npm ci
server.js
migrations/
nav-main/
```

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

一键脚本默认拉的是 **`ghcr.io/alivedou/ikun_nav:latest`**，不是本机源码。源码改完要给用户用上：走 GitHub Actions 发布镜像，或让用户装本地 build 的 tag。

---

## 4. Cloudflare 部署要点（易错）

推荐顺序：

1. 建 KV + D1  
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
| 环境变量 | **`JWT_SECRET` 必需**；TG/CRON 可选 |

`nav-main/wrangler.toml` 含 `nodejs_compat`（jose）。根目录 `wrangler.toml` 在 Root=`nav-main` 时**不会**被 Pages 使用。

边缘侧老库缺列：`nav-main/functions/api/_d1_schema_patch.js` 在 `_middleware.js` 每个 isolate 首次请求时 `waitUntil` 补丁一次。仍建议控制台跑 `sql/schema.upgrade.sql` 更稳。

---

## 5. 数据库维护约定

### 权威源

| 文件 | 角色 |
|------|------|
| **`migrations/0000_init.sql`** | **唯一运行时权威**（Docker + server 自愈 + wrangler migrate） |
| `sql/schema.sql` | 给人看的完整结构，**正文应与 0000 对齐** |
| `sql/schema.console.sql` | CF 控制台粘贴 |
| `sql/schema.upgrade.sql` | 已有库 `ALTER` 补列（duplicate 可忽略） |

### 改表流程

1. 改 **`migrations/0000_init.sql`**（或新增 `migrations/000x_*.sql`）。  
2. 同步 **`sql/schema.sql`**。  
3. 视情况更新 `schema.console.sql` / `schema.upgrade.sql`。  
4. **切记**：`CREATE TABLE IF NOT EXISTS` **不会**给旧表加列；生产老库必须 upgrade SQL 或依赖边缘/本地热补丁。

### 双运行时差异

| | Docker `server.js` | CF Functions |
|--|-------------------|--------------|
| 建表 | 启动读 `migrations/` | 人工/SQL 控制台 + 可选 wrangler |
| 缺列补丁 | server 内 PRAGMA 热补丁 | `_d1_schema_patch.js` |
| 业务数据 | SQLite 表 + 本地文件 KV | D1 表 + KV JSON（`user_config:*`） |

配置主体大量在 **KV JSON**（`settings`、书签等），D1 偏用户/配额/公告/邀请/审计。不要假设「全在 SQL 里」。

---

## 6. 前端约定

- 无 React/Vue 构建链；改 `nav-main/public` 即生效（Docker 需重建镜像）。  
- 主逻辑：`app.js`。搜索体验增量：`search-ux.js`（引擎 localStorage 优先、首字符保留、best-effort 聚焦）。  
- **原则**：能新增模块就新增；少改巨型 `app.js`；禁止无必要重构。  
- 浏览器地址栏焦点无法被网页抢走；「打开浏览器就直接键入进导航搜索」在 omnibox 聚焦时做不到，只能页面拿到焦点后尽量抢搜索框。  
- 本地偏好键示例：`nav_search_engine`、`nav_search_prefix`、`nav_token`、`nav_app_data` 等。

---

## 7. API 与权限

- 路径统一 `/api/*`。  
- CF：`nav-main/functions/api/**` 文件系统路由。  
- VPS：`server.js` Express 对齐同路径。  
- 鉴权：JWT（`jose`）+ `Authorization: Bearer`。  
- 中间件：`_middleware.js`（CF）/ server 内 `authenticate`。  
- 改接口时 **两边都要看**，避免只修 Functions 忘了 server（或相反）。

---

## 8. 常用命令

```bash
# 本地开发（Node 模拟 D1/KV）
npm install
cp .env.example .env   # 配 JWT_SECRET 等
npm run dev            # http://localhost:3000

# Wrangler 本地 Pages 模拟
npm run preview
npm run db:migrate     # 本地 D1 迁移

# 代码风格
npm run lint
npm run format
```

---

## 9. 改动时检查清单

- [ ] 是否破坏「根目录勿动」文件路径？  
- [ ] 若改表：是否更新了 `migrations/` + `sql/`？  
- [ ] 若改 API：Functions **与** `server.js` 是否对称？  
- [ ] 若改前端：Docker 用户是否需要 **新镜像**？  
- [ ] 若改 `ikun.sh`：README 里的 raw URL 是否仍有效？  
- [ ] CF 相关：binding 名是否仍是 `nav` / `DB`？`JWT_SECRET` 是否文档有写？  
- [ ] 本地或容器上是否自测关键路径（打开首页、登录、搜索、同步）？  

---

## 10. 已知坑（排障）

| 现象 | 方向 |
|------|------|
| `no such table` | D1/SQLite 未初始化；CF 绑错库或未跑 schema |
| `no such column` | 老库缺列；跑 `sql/schema.upgrade.sql` 或等补丁 |
| 一键脚本仍是旧功能 | GHCR `latest` 未发布新镜像 |
| 搜索引擎刷新变回必应 | 看 `search-ux` / localStorage 与云端 settings 优先级 |
| 键入丢首字符 | `search-ux.js` capture + `app.js` 防双写标记 |
| Pages 有静态无 API | Root 不是 `nav-main` 或未绑 KV/D1 |
| 登录异常 | 缺 `JWT_SECRET` 或两端密钥不一致 |

---

## 11. 给 AI 的硬约束

1. **增量开发**：优先新文件/新函数，禁止为「好看」重构。  
2. **不删现有功能**，不擅自改对外 URL 与 binding 名。  
3. **双部署意识**：改运行时逻辑时同时考虑 Docker 与 CF。  
4. **SQL 权威在 `migrations/`**，不要只改 `sql/` 就当修完库。  
5. **不要**把 `schema*.sql` 拷进 Dockerfile「顺便」——除非产品明确要求镜像内带控制台 SQL。  
6. 大改前说明：修改位置、影响范围、风险；能写检查步骤就写。  
7. 用户未要求时：**不擅自 git commit / push / 发布镜像**。  

---

## 12. 相关文档

| 文档 | 用途 |
|------|------|
| `README.md` | 用户向安装（Docker 一键 + CF 步骤） |
| `sql/README.md` | SQL 双份维护 |
| `docs/deployment-docker.md` / `docs/deployment.md` | 展开部署说明 |
| `docs/REQUIREMENTS.md` | 历史需求/规格（可能与实现有偏差，以代码为准） |
| `docs/README.md` | 文档目录索引 |

---

*维护时以代码与本文为准；REQUIREMENTS 与实现冲突时，先核对 `server.js` / `nav-main/functions` 再改文档。*

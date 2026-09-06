# CF-nav 重构：测试项目与验收标准

对象：https://github.com/alivedou/CF-nav `v4`  
配套施工单：[REFACTORING.md](./REFACTORING.md)

v4 目前几乎没有自动化测试，只有手工 Docker 清单 `docs/TESTING-REPORT.md`。重构期间 **测试不是收尾**：没有基线快照不准改业务；阶段测试没绿不准进下一阶段。

测试代码加在 **CF-nav 仓库**（本仓库 `tests/`）。用 Node 22 自带 `node --test`；阶段 4 再加 Playwright。

---

## 0. 门禁规则

1. **阶段 B 的契约快照进 git。** 之后任何阶段 baseline 红了，先修回归。
2. 配额、id 重映射、sanitize、PATCH_SQL **必须单测**，禁止只靠手工。
3. 阶段 3 起强制双运行时：只测 Node、不测 Pages，算没过。
4. 阶段 4 起必须有 Playwright smoke。搜索首字符、引擎刷新是历史回归点。
5. 视觉基线允许更新，PR 必须写明改了什么外观。

合并前命令：

```bash
npm run test:baseline          # 每阶段
npm run test:unit              # 阶段 1 起
npm run test:phaseN            # 只跑当前阶段
npm run test:dual              # 阶段 3 起
npx playwright test            # 阶段 4–5
npm run test:sql               # 阶段 6
```

---

## 1. 测试项目目录

在 CF-nav 根目录新增：

```
tests/
├── README.md
├── fixtures/
│   ├── baseline/              # 阶段 B 冻结的 HTTP 快照
│   ├── route-map.json         # 允许的 method+path
│   ├── window-api.json        # 必须挂到 window 的函数名
│   ├── css-selectors.json
│   ├── nav-export.sample.json
│   ├── old-db.sqlite          # 缺列的老库
│   └── screenshots/
├── helpers/
│   ├── api.mjs
│   ├── reset-db.mjs
│   └── dual.mjs
├── baseline/contract.test.mjs
├── unit/                      # quota / ids / sanitize / schema-patch / default-data
├── phase0/ … phase6/
└── e2e/                       # Playwright
```

`package.json` 增加：

```json
{
  "scripts": {
    "test": "node --test tests/unit tests/baseline",
    "test:baseline": "node --test tests/baseline",
    "test:unit": "node --test tests/unit",
    "test:phase0": "node --test tests/phase0",
    "test:phase1": "node --test tests/phase1 tests/unit",
    "test:phase2": "node --test tests/phase2 tests/baseline",
    "test:phase3": "node --test tests/phase3 tests/unit/ids.test.mjs",
    "test:dual": "node --test tests/phase3/dual-runtime.test.mjs",
    "test:phase4": "node --test tests/phase4 && playwright test tests/e2e/smoke.spec.ts tests/e2e/search.spec.ts",
    "test:phase5": "node --test tests/phase5 && playwright test tests/e2e/visual.spec.ts tests/e2e/responsive.spec.ts",
    "test:sql": "node --test tests/phase6",
    "test:capture": "node tests/scripts/capture-baseline.mjs"
  }
}
```

CI（`.github/workflows/test.yml`）：在 Node 22 里 `npm ci` 后跑 `test:unit` + `test:baseline`（需要先起 `npm start` 或测试自己 spawn 服务器）。Playwright 放到阶段 4 的 workflow job，允许 `workflow_dispatch`。

辅助约定：

- 测试用独立 `DB_PATH` / `local_kv` 目录（例如 `tests/.tmp/`），禁止打开发者自己的 `local_d1.db`。
- JWT_SECRET 用固定测试值，写在 `tests/helpers`，不进生产镜像。
- 时间字段（`lastUpdated`、日报时间戳）快照用正则忽略。

---

## 2. 阶段 B · 基线冻结（改代码之前）

**目的：** 把当前 v4 的 HTTP 行为钉死。没有这份快照，后面无法证明「重构没改功能」。

**文件：**

| 路径 | 内容 |
|------|------|
| `tests/scripts/capture-baseline.mjs` | 对空库走一遍注册/登录/读写，把响应写入 `fixtures/baseline/` |
| `tests/baseline/contract.test.mjs` | 以后每阶段都跑，和快照 diff |
| `tests/fixtures/route-map.json` | 现网允许的 method+path 列表 |
| `tests/fixtures/nav-export.sample.json` | 带身份字段的脏导出，供清洗测试 |

**用例与通过标准：**

| ID | 用例 | 通过标准 |
|----|------|----------|
| A-1 | 游客读 config | GET `/api/config` → 200，带默认分类 |
| A-2 | 匿名写 config | POST `/api/config` 无 token → 401 |
| A-3 | 空登录体 | POST `/api/auth/login` `{}` → 400，进程不崩 |
| A-4 | 首位注册 | 空库 POST `/api/auth/register` → 200，`role=admin` |
| A-5 | 登录发 token | 正确密码 → 200 + JWT |
| A-6 | 鉴权读 config | Bearer → 200 |
| A-7 | 鉴权写 config | 合法书签 JSON → 200，再 GET 能读回同名分类 |
| A-8 | 错误密码 | 401 |
| A-10 | Bing | GET `/api/bing` → 200 |
| A-11 | 用户侧公告 | GET `/api/announcements` → 200 |
| A-12 | 管理接口拒绝匿名 | GET `/api/admin/users` 无 token → 403 |
| Q-1 | 普通用户超分类配额 | 13 个分类 → 4xx，库内容与提交前一致 |
| I-1 | 导出去身份 | JSON 不含 `user` / `role` / `quota` / `isAdmin` |
| I-2 | 导入换新 id | categories/items 的 id 与文件内原值全部不同 |
| D-1 | 首页 | GET `/` → 200，HTML 含导航壳 |

**本阶段验收：**

- [ ] `npm run test:capture` 生成的快照已提交。
- [ ] `npm run test:baseline` 在刚捕获后立即全绿（自洽）。
- [ ] `route-map.json` 覆盖 AGENTS.md 第 7 节全部路径。

编号 A-* / D-* 与现有 `TESTING-REPORT.md` 对齐，方便对照历史失败项（空登录体曾经炸过进程）。

---

## 3. 按重构阶段：测试内容 × 验收

### 阶段 0 · 卫生清理

**测试文件**

- `tests/phase0/hygiene.test.mjs`
- `tests/baseline/contract.test.mjs`（回归）

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| B-0 | 基线已存在 | 读 `fixtures/baseline/` | 目录非空，含 auth/config 快照 |
| P0-1 | 死文件消失 | 断言根目录 | 无 `metadata.json`、无 `.eslintrc.json`；`eslint.config.js` 仍在 |
| P0-2 | site-config 只注册一次 | 扫描入口里的 `app.get/post('/api/admin/site-config')` | GET、POST 各恰好 1 次 |
| P0-3 | 契约未漂 | 跑 baseline | 与 B-0 快照零 diff |

**验收（全满足）**

- [ ] `npm run test:baseline` 全绿，且等于已提交快照。
- [ ] `npm run test:phase0` 全绿。
- [ ] `git diff` 不含路由处理函数体、不含 SQL、不含前端逻辑。

---

### 阶段 1 · 共享领域层

**测试文件**

- `tests/unit/quota.test.mjs`
- `tests/unit/schema-patch.test.mjs`
- `tests/unit/default-data.test.mjs`
- `tests/phase1/no-duplicate-source.test.mjs`

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| P1-1 | 配额表 | 单测 `getQuota` 五个角色 | guest 6/12，user 12/25，invited 15/30，super 20/40，admin 150/500；无用户按 guest |
| P1-2 | 配额单源 | `rg QUOTA_CONFIG` | 只在 `nav-main/shared/quota.js` 与测试里出现定义 |
| P1-3 | PATCH_SQL 同源 | 比较 Node 补丁列表与 CF `_d1_schema_patch` 实际 SQL | 集合相等；列已存在时 ALTER 被吞掉 |
| P1-4 | 默认书签单源 | 比较 defaultData 指纹 | server 与 Functions import 同一模块 |
| P1-5 | shared 无运行时私货 | 扫描 `nav-main/shared` 的 import | 不得 import `better-sqlite3` / `express` / `fs` / `path` |

**验收（全满足）**

- [x] `npm run test:unit` 与 `test:phase1` 全绿。
- [x] 配额只在 `nav-main/shared/quota.js` 定义；超限由 baseline Q-1 覆盖。双运行时对照放到阶段 3 `test:dual`。
- [x] baseline 相对阶段 0 快照仍为零 diff。

---

### 阶段 2 · 拆 server.js

**测试文件**

- `tests/phase2/route-map.test.mjs`
- `tests/phase2/docker-copy.test.mjs`
- `tests/baseline/contract.test.mjs`

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| P2-1 | 路由表完整 | 收集已挂载 path+method，对照 `route-map.json` | 14 组 API 一条不少、无多余 path |
| P2-2 | 空登录体 | POST login `{}` 与缺 password | 400 + `ERR_MISSING_*`，进程仍在 |
| P2-3 | 注册登录写配置 | 空库注册→登录→GET/POST config | 首位 admin；写回可读；匿名 POST 仍 401 |
| P2-4 | Docker COPY | 解析 Dockerfile | 含 `src/`（或拆后入口）；镜像能 build |
| P2-5 | 管理鉴权 | 无 token GET `/api/admin/users` | 403（或与基线相同拒绝码，不得 200） |

**验收（全满足）**

- [x] `npm run test:phase2` 全绿。
- [x] 契约快照零 diff（时间字段正则忽略）。
- [x] Dockerfile 含 `COPY src/`；`server.js` 仍为 CMD 入口。镜像 build 在有 Docker 的环境再验。

---

### 阶段 3 · Functions 薄适配器

**测试文件**

- `tests/unit/ids.test.mjs`
- `tests/phase3/config-handler.test.mjs`
- `tests/phase3/dual-runtime.test.mjs`
- `tests/phase3/kv-key-compat.test.mjs`

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| P3-1 | id 重映射 | 两次 POST 相同 `category.id` / `item.id` | 第二次 SQL 主键不同；无 UNIQUE 500 |
| P3-2 | 超配额拒绝 | 普通用户 13 分类或单分类 26 书签 | 4xx，库保持提交前快照 |
| P3-3 | 双运行时 | 同一组请求打 Node 与 wrangler preview | 状态码一致；`name`/`url` 集合相等 |
| P3-4 | KV 键名未乱改 | 断言 CF 仍 `user_config:<uuid>`，Node 仍 `local_kv/user_<uuid>.json` | 键名被「统一」视为失败 |
| P3-5 | 无第二份配额 | `rg QUOTA_CONFIG` 于 functions/ 与 src/server/ | 零定义，只 import shared |

**验收（全满足）**

- [x] `npm run test:phase3` 与 `test:dual` 全绿。
- [x] id 重映射实现只出现在 `nav-main/shared`（运行时：functions / src/server）。
- [x] 导入带旧 id 的 JSON 后，两端都能再保存成功（dual-runtime 两次 POST 同 id）。

---

### 阶段 4 · 前端拆模块

**测试文件**

- `tests/unit/sanitize.test.mjs`
- `tests/phase4/module-boot.test.mjs`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/search.spec.ts`
- `tests/e2e/admin.spec.ts`
- `tests/fixtures/window-api.json`

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| P4-1 | 入口是 module | 解析 `index.html` script | 主入口 `/assets/js/main.js` 且 `type=module`；无「必须最后加载」的 search-ux.js |
| P4-2 | window 兼容桥 | jsdom/Playwright 求值 | `showToast` / `closeAllModals` / `updateStyles` 等均为 function，名单在 window-api.json |
| P4-3 | 搜索首字符 | E2E：页面焦点下直接键入 | 搜索框出现且第一个字符保留 |
| P4-4 | 引擎持久化 | E2E：切到百度后刷新 | 仍是百度，不被云端 settings 打回必应 |
| P4-5 | PWA 缓存版本 | 读 `CACHE_NAME` 对比上一 git 版本 | 字符串已升高；旧 `app.js` 不再 Precache |
| P4-6 | 导入清洗 | 单测 sanitize | 去掉身份字段；导入后 id 全换新 |

**验收（全满足）**

- [x] `npx playwright test tests/e2e` 全绿（桌面 1280 与手机 390 各跑 smoke）。
- [x] `npm run test:phase4` 全绿。
- [ ] 手工（本阶段允许作为补充，不能替代 E2E）：禅意开关、侧边栏钉住、拖拽一张卡片、后台四个 Tab 能打开列表。

Playwright 建议 `testId` 先用现有 `id`（`#sidebar`、`#btn-summon-search`），不要为测试改视觉。

---

### 阶段 5 · CSS / HTML 减负

**测试文件**

- `tests/phase5/css-order.test.mjs`
- `tests/e2e/visual.spec.ts`
- `tests/e2e/responsive.spec.ts`
- `tests/fixtures/css-selectors.json`
- `tests/fixtures/screenshots/`（Playwright `toHaveScreenshot` 基线，路径见 `playwright.config.ts` 的 `snapshotPathTemplate`）

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| P5-1 | CSS 顺序 | 解析 `link[rel=stylesheet]` | tokens 最先；`@import` 不超过一层 |
| P5-2 | 关键选择器 | grep 拆后 CSS | `css-selectors.json` 中的选择器都能找到 |
| P5-3 | 主题与禅意 | 截图对比基线 | 暗色/亮色/禅意/管理模式，像素 diff &lt; 0.3% |
| P5-4 | 移动端抽屉 | 390×844 点汉堡再点遮罩 | 侧栏可开关；搜索召唤按钮可点 |

**验收（全满足）**

- [x] `npm run test:phase5` 全绿。
- [x] 四张视觉基线通过，或更新基线时 PR 写明外观改动原因。
- [x] 密度 / 卡片宽度滑块仍改变网格（不要求动画像素级一致）。

---

### 阶段 6 · SQL 单一权威

**测试文件**

- `tests/phase6/sql-source.test.mjs`
- `tests/phase6/old-db-upgrade.test.mjs`
- `tests/phase6/docker-no-sql-dir.test.mjs`
- `tests/fixtures/old-db.sqlite`

**用例**

| ID | 测什么 | 怎么测 | 期望 |
|----|--------|--------|------|
| P6-1 | CREATE 对齐 | 解析 `0000_init.sql` 与 `sql/schema.sql` | 表名集合、列名集合相等 |
| P6-2 | upgrade 与 PATCH 同源 | 比较 ALTER 集合 | 与 `shared/schema-patch.js` 的 PATCH_SQL 相等（忽略空白） |
| P6-3 | 缺列表能补上 | 用去掉 `users.email` 的旧库启动 | PRAGMA 含 email；接口不报 `no such column` |
| P6-4 | sql/ 不进镜像 | 解析 Dockerfile | 不得 `COPY sql/` |

**验收（全满足）**

- [ ] `npm run test:sql` 全绿。
- [ ] 旧库 fixture 启动后注册 / 登录 / 读 config 成功。
- [ ] AGENTS.md 写明：改表 PR 必须同时改 migrations + PATCH；CI 跑 `sql:check`。

---

## 4. 手工补充清单（自动化覆盖不到的）

以下每阶段结束时点一次即可，失败则该阶段不算过。不必写成 Playwright，除非反复回归。

- [ ] 魔棒抓图标（需外网）
- [ ] IndexedDB 大图背景：上传后刷新不闪、不丢
- [ ] 分享只读页 `GET /api/share?slug=`
- [ ] 临时密码登录后强制改密
- [ ] cron-digest：本地无密钥时控制台打印日报（不发真邮件）
- [ ] Telegram 告警：仅在有测试 bot 时测，无密钥则跳过并记录

Docker 体积回归（沿用 TESTING-REPORT 的 D-4 / D-7）：

- [ ] 数据写在挂载卷 `/app/local_kv`
- [ ] 容器重启后仍能用同一账号登录

---

## 5. 双运行时怎么测

| 运行时 | 地址 | 数据 |
|--------|------|------|
| Node `npm run dev` | `http://127.0.0.1:3000` | `tests/.tmp/node/` 下的 sqlite + kv |
| Wrangler `npm run preview` | wrangler 打印的端口 | `.wrangler/` 或单独 `--persist-to tests/.tmp/cf/` |

`tests/helpers/dual.mjs` 对同一组请求打两个 origin，比较 status 与规范化 JSON（去掉时间戳、去掉服务端生成的新 id 再比结构）。

阶段 0–2：只强制 Node。  
阶段 3 起：`test:dual` 红 = 阶段失败。

---

## 6. 和旧 TESTING-REPORT 的关系

旧报告是 2026-07 对 Docker 容器的一次手工抽样。本文件不取代它，而是：

- 把其中已验证的 A-1…A-12、D-1 收进 **可重复的 baseline**；
- 补上重构真正会踩的坑：配额拷贝、id 重映射、KV 键名、脚本加载顺序、CSS 拆分、旧库缺列。

旧报告里的 A-3（空登录体搞崩进程）必须永远留在 baseline 里。

export const SOURCE_REPO = "https://github.com/alivedou/CF-nav";
export const SOURCE_BRANCH = "v4";

export const stats = [
  { label: "源码文件", value: "64", hint: "不含 lockfile / git" },
  { label: "app.js", value: "4,388 行", hint: "前端主业务，约 192 KB" },
  { label: "style.css", value: "5,739 行", hint: "全部视觉挤在一个文件" },
  { label: "server.js", value: "1,968 行", hint: "Express 把全部 API 写了一遍" },
  { label: "page-manage.js", value: "1,290 行", hint: "分类 / 书签 CRUD + 拖拽" },
  { label: "user-manage.js", value: "1,438 行", hint: "后台用户 / 邀请 / 公告 / 审计" },
];

export const verdict = {
  title: "乱，但不该推倒重写",
  body: "v4 已经能双部署跑通：Cloudflare Pages + KV + D1，以及 VPS Docker + SQLite。功能本身是齐的。结构乱，是因为同一套业务在两套运行时各写一遍，再叠加几个上帝文件、四份 SQL、以及过时文档。重构目标是把「改一处、两端生效」做成常态，而不是换成 React / Next。",
};

export type Pain = {
  id: string;
  title: string;
  severity: "高" | "中" | "低";
  where: string;
  problem: string;
  keep: string;
};

export const pains: Pain[] = [
  {
    id: "dual-runtime",
    title: "业务逻辑写了两遍",
    severity: "高",
    where: "server.js ↔ nav-main/functions/api/*",
    problem:
      "每一条 /api/* 在 Express 和 Pages Functions 各有一份实现。配额 QUOTA_CONFIG、告警发信、JWT 鉴权、schema 热补丁、id 重映射都是拷贝。改配额或改保存逻辑必须改两处，漏一处就会出现「本地和线上行为不一致」。server.js 里 /api/admin/site-config 甚至注册了两套相同路由。",
    keep: "双部署本身要保留。抽出共享领域层，两端只留薄适配器。",
  },
  {
    id: "god-files",
    title: "几个上帝文件扛了整个产品",
    severity: "高",
    where: "app.js / server.js / style.css / index.html",
    problem:
      "app.js 同时管启动、登录注册、卡片渲染、搜索、禅意模式、公告、个人资料、IndexedDB 背景、Emoji、Monaco JSON 编辑。style.css 5.7k 行按历史 Task 号堆叠。index.html 403 行，快捷键指南还夹着大段 inline style。新功能只能往这些文件尾部追加，所以会越来越乱。",
    keep: "继续用无打包 Vanilla JS，用原生 ES module 按功能拆文件，先保留 window.* 兼容。",
  },
  {
    id: "sql-copies",
    title: "表结构有四份，再加两份热补丁",
    severity: "高",
    where: "migrations / sql/* / server.js / _d1_schema_patch.js",
    problem:
      "权威源声称是 migrations/0000_init.sql，但 sql/schema.sql、schema.console.sql、schema.upgrade.sql 要人手对齐。Node 启动时 PRAGMA 补列，边缘 isolate 首次请求再 waitUntil 补一遍。改一列要改 6 个地方，漏了就是 no such column。",
    keep: "migrations 仍是运行时权威。控制台 SQL 从权威源生成，热补丁合成一份共享 PATCH_SQL。",
  },
  {
    id: "pages-root",
    title: "nav-main 是部署约束，不是领域边界",
    severity: "中",
    where: "仓库根 + nav-main/",
    problem:
      "Cloudflare Pages 的 Root directory 必须是 nav-main，所以 public/ 与 functions/ 被塞进这个历史目录名。根目录又有一份不会被 Pages 读到的 wrangler.toml。两套 package.json、两套 eslint 配置、metadata.json 还是旧 Gemini 残留。看起来像半成品 monorepo，其实只是部署目录。",
    keep: "短期内不要改 Pages Root。共享代码必须放进 nav-main/ 里，Node 再从那里 import——defaultData.js 已经是这个模式。",
  },
  {
    id: "globals",
    title: "前端靠 window 全局和加载顺序粘合",
    severity: "中",
    where: "public/assets/js/* + index.html 脚本顺序",
    problem:
      "模块之间通过 window.showToast、window.sysToken、window.closeAllModals 通信。search-ux.js 必须在 app.js 之后加载，靠覆盖/补丁修搜索首字符和引擎持久化。顺序一乱，功能就 silently 坏。emoji 选择器还在 app.js 和 emoji-pool.js 两边出现。",
    keep: "第一轮拆文件时继续导出到 window，保证现有 inline onclick 还能用；第二轮再换成显式 import。",
  },
  {
    id: "docs-drift",
    title: "文档和死文件在撒谎",
    severity: "低",
    where: "README / docs/deployment.md / .eslintrc.json / metadata.json",
    problem:
      "README 仍有段落写 TOKEN / kv_mock.json，实际已是 JWT + local_kv/。docs/deployment.md、REQUIREMENTS.md 偏早期手写。根目录 .eslintrc.json 与 eslint.config.js 并存，npm run lint 只用后者。metadata.json 不参与运行。",
    keep: "对外手册只留 README + AGENTS.md；过时文档标归档或删。",
  },
];

export const currentTree = `CF-nav/                          # 生产分支 v4
├── server.js                    # 1968 行：Node 唯一入口，全部 API 写在这
├── package.json                 # Docker / 本地 npm run dev
├── Dockerfile                   # 只 COPY server.js + migrations + nav-main
├── ikun.sh                      # GitHub raw 一键脚本，路径不能挪
├── wrangler.toml                # Pages Root=nav-main 时不生效
├── wrangler.toml.example
├── eslint.config.js             # 现行 lint
├── .eslintrc.json               # 旧残留
├── metadata.json                # Gemini 残留，不参与运行
├── migrations/0000_init.sql     # 运行时权威表结构
├── sql/                         # 给人看的 SQL，不进 Docker
│   ├── schema.sql               # 应与 0000 对齐，靠人手
│   ├── schema.console.sql
│   └── schema.upgrade.sql
├── nav-main/                    # ★ CF Pages 构建根
│   ├── wrangler.toml            # nodejs_compat（jose）
│   ├── package.json             # 只有 jose
│   ├── public/
│   │   ├── index.html           # 403 行，所有弹窗都在这
│   │   ├── ServiceWorker.js
│   │   └── assets/
│   │       ├── css/style.css    # 5739 行
│   │       └── js/
│   │           ├── app.js       # 4388 行上帝文件
│   │           ├── page-manage.js
│   │           ├── user-manage.js
│   │           ├── search-ux.js # 必须最后加载的补丁
│   │           └── …
│   └── functions/api/           # 文件即路由
│       ├── _middleware.js
│       ├── _d1_schema_patch.js
│       ├── defaultData.js       # 目前唯一被 server.js import 的共享文件
│       ├── config.js            # 又一份 QUOTA_CONFIG
│       ├── auth/ login.js register.js
│       ├── admin/ …
│       └── user/ profile.js
└── docs/                        # 长文档，质量不齐`;

export const targetTree = `CF-nav/
├── ikun.sh                      # 仍在仓库根，raw URL 不变
├── Dockerfile                   # COPY 白名单扩到 src/ + nav-main/shared
├── package.json                 # 本地 / Docker 入口
├── README.md / AGENTS.md
├── src/server/                  # Express 适配器（从 server.js 拆出）
│   ├── index.js                 # 启动、静态资源、监听端口
│   ├── db.js                    # SQLite 打开、跑 migrations
│   ├── kv-fs.js                 # local_kv/ 文件模拟 KV
│   ├── middleware/auth.js
│   └── routes/                  # 每个路由文件对应一组 /api
│       ├── auth.js
│       ├── config.js
│       ├── share.js
│       ├── announcements.js
│       ├── profile.js
│       ├── proxy.js
│       └── admin/*.js
├── nav-main/                    # Pages Root 不变，避免控制台再配一次
│   ├── wrangler.toml
│   ├── package.json
│   ├── shared/                  # ★ 两端共同的领域层（关键）
│   │   ├── quota.js             # QUOTA_CONFIG + getQuota
│   │   ├── default-data.js      # 默认分类 / 书签（现 defaultData.js）
│   │   ├── schema-patch.js      # 唯一一份 PATCH_SQL
│   │   ├── time.js              # formatCNTime
│   │   ├── alerts.js            # Telegram / Resend 报文
│   │   ├── ids.js               # 分类/书签 id 重映射
│   │   └── handlers/            # 与存储无关的用例（可选，阶段 3）
│   ├── functions/api/           # 薄 CF 适配器：读 env，调 shared
│   └── public/
│       ├── index.html           # 只留壳：布局 + script type=module
│       ├── sw.js
│       └── assets/
│           ├── css/
│           │   ├── tokens.css
│           │   ├── layout.css
│           │   ├── sidebar.css
│           │   ├── cards.css
│           │   ├── modals.css
│           │   └── admin.css
│           └── js/
│               ├── main.js      # 启动入口
│               ├── core/        # api-client、storage、dom
│               └── features/    # auth / nav / search / zen / admin / sync
├── db/migrations/               # 从根 migrations/ 挪过来或保持原路径
└── sql/                         # 由 migrations 生成，不再手抄四份`;

export const mapping = [
  {
    from: "server.js 全文件",
    to: "src/server/* + nav-main/shared/*",
    note: "启动与 Express 路由留在 Node 侧；配额、补丁、默认数据、告警进 shared。",
  },
  {
    from: "functions/api/defaultData.js",
    to: "nav-main/shared/default-data.js",
    note: "已经是唯一共享点，按这个模式扩。",
  },
  {
    from: "QUOTA_CONFIG × 2",
    to: "nav-main/shared/quota.js",
    note: "getQuota 的 has_invite 查询由适配器注入，不把 SQL 写进领域层。",
  },
  {
    from: "server.js 热补丁 + _d1_schema_patch.js",
    to: "nav-main/shared/schema-patch.js",
    note: "一份 PATCH_SQL；Node 用 PRAGMA 执行，CF 用 waitUntil。",
  },
  {
    from: "app.js",
    to: "public/assets/js/features/{boot,auth,render,search,zen,notices,profile,idb}",
    note: "先按函数块物理拆分，对外仍挂 window，行为零变化。",
  },
  {
    from: "search-ux.js",
    to: "features/search/",
    note: "它是补丁，应合并进搜索模块，不要永远「最后再加载一次」。",
  },
  {
    from: "page-manage.js / user-manage.js",
    to: "features/page-manage/ 与 features/admin/",
    note: "已经按功能切开了，内部再按 tab 拆文件即可。",
  },
  {
    from: "style.css",
    to: "assets/css/*.css 多文件 + index 里按序 link",
    note: "不要用深层 @import（阻塞渲染）。Tokens 必须先于其它文件。",
  },
  {
    from: "sql/schema*.sql 手抄",
    to: "migrations 权威 + 生成脚本",
    note: "schema.upgrade.sql 继续给人跑老库，但补列列表与 PATCH_SQL 同源。",
  },
  {
    from: ".eslintrc.json / metadata.json / 根 wrangler.toml",
    to: "删除或标明废弃",
    note: "阶段 0 就能做，零行为风险。",
  },
];

export type TestCase = {
  id: string;
  name: string;
  how: string;
  expect: string;
};

export type Phase = {
  id: string;
  name: string;
  risk: string;
  goal: string;
  steps: string[];
  doneWhen: string[];
  notThisPhase: string[];
  testFiles: string[];
  testCases: TestCase[];
  accept: string[];
};

export const phases: Phase[] = [
  {
    id: "p0",
    name: "阶段 0 · 卫生清理",
    risk: "极低",
    goal: "先让仓库看起来诚实，不动运行时行为。",
    steps: [
      "删除 metadata.json、根目录 .eslintrc.json。",
      "删除 server.js 里后注册的那套 /api/admin/site-config（Express 本来就只跑先注册的）。",
      "根 wrangler.toml 加注释「Pages 不读这个」，或改成指向 nav-main 的说明文件，避免以后改错。",
      "README 去掉 TOKEN / kv_mock.json；以 JWT_SECRET + local_kv/ 为准。",
      "docs/deployment.md、REQUIREMENTS.md 顶部加「可能过时，以 AGENTS.md 与代码为准」。",
    ],
    doneWhen: [
      "npm run dev / Docker 构建与现在完全一致。",
      "git diff 不含业务逻辑。",
    ],
    notThisPhase: ["不改目录名", "不拆 app.js", "不改 Pages Root"],
    testFiles: [
      "tests/baseline/contract.test.mjs",
      "tests/phase0/hygiene.test.mjs",
      "tests/scripts/capture-baseline.mjs",
    ],
    testCases: [
      {
        id: "B-0",
        name: "先钉基线再改代码",
        how: "npm run test:baseline 对当前 v4 打快照到 tests/fixtures/baseline/",
        expect: "auth/config/admin 的状态码与关键 JSON 字段写入仓库，后续阶段对这份 diff",
      },
      {
        id: "P0-1",
        name: "死文件已消失",
        how: "断言仓库根不存在 metadata.json、.eslintrc.json",
        expect: "文件不存在；eslint.config.js 仍在且 npm run lint 可跑",
      },
      {
        id: "P0-2",
        name: "site-config 只注册一次",
        how: "扫描 server.js 中 app.get/post('/api/admin/site-config') 次数",
        expect: "GET、POST 各恰好 1 次",
      },
      {
        id: "P0-3",
        name: "契约未漂",
        how: "跑完整 baseline 套件（Node :3000）",
        expect: "与 B-0 快照零 diff；首页 200；匿名写 config 仍 401",
      },
    ],
    accept: [
      "test:baseline 全绿，且与提交的 fixtures/baseline 一致。",
      "npm run test:phase0 全绿。",
      "git diff 不含路由处理函数体、不含 SQL、不含前端逻辑。",
    ],
  },
  {
    id: "p1",
    name: "阶段 1 · 抽出共享领域层",
    risk: "低",
    goal: "改配额、默认书签、缺列补丁只改一个文件。",
    steps: [
      "新建 nav-main/shared/，先搬 defaultData.js。",
      "抽出 quota.js、time.js、schema-patch.js、alerts.js。",
      "server.js 与 functions 改为 import 这些模块，删除各自拷贝。",
      "getQuota 的 has_invite 通过回调 / 适配器传入，避免 shared 依赖 better-sqlite3 或 env.DB。",
      "Dockerfile 已 COPY nav-main/，无需改白名单。",
    ],
    doneWhen: [
      "改 shared/quota.js 一处，本地 Node 与 wrangler preview 配额同时变。",
      "两端 schema 补丁 SQL 字符串相同。",
    ],
    notThisPhase: ["还不做通用 Storage Port", "不改 KV 键名", "不拆前端"],
    testFiles: [
      "tests/unit/quota.test.mjs",
      "tests/unit/schema-patch.test.mjs",
      "tests/unit/default-data.test.mjs",
      "tests/phase1/no-duplicate-source.test.mjs",
    ],
    testCases: [
      {
        id: "P1-1",
        name: "配额表",
        how: "单测 getQuota：guest/user/invited_user/super_user/admin",
        expect: "6/12、12/25、15/30、20/40、150/500；无用户按 guest",
      },
      {
        id: "P1-2",
        name: "配额只有一份源",
        how: "rg QUOTA_CONFIG 全仓库",
        expect: "只出现在 nav-main/shared/quota.js 与测试；server/functions 不得再定义对象字面量",
      },
      {
        id: "P1-3",
        name: "PATCH_SQL 同源",
        how: "比较 Node 启动补丁列表与 _d1_schema_patch 实际执行的 SQL",
        expect: "字符串集合相等；ALTER 失败（列已存在）必须被吞掉",
      },
      {
        id: "P1-4",
        name: "默认书签单源",
        how: "比较 defaultData 的 categories/items 指纹",
        expect: "server import 与 Functions import 是同一模块；改一处两边 JSON 指纹相同",
      },
      {
        id: "P1-5",
        name: "shared 无 Node/Worker 私货",
        how: "扫描 nav-main/shared 的 import",
        expect: "不得 import better-sqlite3、express、fs、path；不得读 process.env.DB_PATH",
      },
    ],
    accept: [
      "npm run test:unit 与 test:phase1 全绿。",
      "临时把 admin 配额改成 149，Node 与 wrangler preview 的超限 POST /api/config 同时失败；测完改回。",
      "baseline 契约套件相对阶段 0 快照仍为零 diff。",
    ],
  },
  {
    id: "p2",
    name: "阶段 2 · 拆开 server.js",
    risk: "低",
    goal: "Node 入口变成「启动 + 挂路由」，每个 API 一组文件。",
    steps: [
      "src/server/index.js 只做 dotenv、打开 DB、static、listen。",
      "按现有路由切：auth / config / bing / share / announcements / profile / admin/*。",
      "package.json main 指向 src/server/index.js；Dockerfile COPY src/。",
      "路由路径、状态码、JSON 字段与现在逐条对照。",
    ],
    doneWhen: [
      "server.js 从仓库消失或只剩 re-export。",
      "本地注册首位管理员、登录、保存书签、导入导出与拆前一致。",
    ],
    notThisPhase: ["不改 Functions 文件结构", "不改前端"],
    testFiles: [
      "tests/baseline/contract.test.mjs",
      "tests/phase2/route-map.test.mjs",
      "tests/phase2/docker-copy.test.mjs",
    ],
    testCases: [
      {
        id: "P2-1",
        name: "路由表完整",
        how: "从 src/server/routes 收集已挂载 path+method，对照 tests/fixtures/route-map.json",
        expect: "14 组 API 一条不少；无多余 path",
      },
      {
        id: "P2-2",
        name: "空登录体",
        how: "POST /api/auth/login {} 与缺 password",
        expect: "400 + code ERR_MISSING_* ；进程不退出（对照原 A-3 回归）",
      },
      {
        id: "P2-3",
        name: "注册登录写配置闭环",
        how: "空库注册 → 登录拿 token → GET/POST /api/config → 错误密码 401",
        expect: "首位 role=admin；写回后 GET 能读到同分类名；匿名 POST 仍 401",
      },
      {
        id: "P2-4",
        name: "Docker COPY 含 src/",
        how: "解析 Dockerfile，断言 COPY src 或等价路径",
        expect: "镜像构建上下文包含拆后入口；CMD 能启动",
      },
      {
        id: "P2-5",
        name: "管理接口鉴权",
        how: "无 token 打 GET /api/admin/users",
        expect: "403（或与基线相同的拒绝码，不得变成 200）",
      },
    ],
    accept: [
      "npm run test:phase2 全绿。",
      "对照 fixtures/baseline 的契约快照零 diff（允许 Date/lastUpdated 一类时间字段用正则忽略）。",
      "docker build 成功；容器内 curl 首页 200。本阶段不要求改 Functions。",
    ],
  },
  {
    id: "p3",
    name: "阶段 3 · Functions 改成薄适配器",
    risk: "中",
    goal: "写接口只改 shared/handlers，CF 与 Node 各包一层存储。",
    steps: [
      "定义最小 StoragePort：kv.get/put/delete、db.prepare、waitUntil、env 密钥。",
      "把 config 保存（含配额校验与 id 重映射）、登录防爆破、公告读写做成 handler。",
      "functions/api/*.js 只做 onRequest* → 取 context.env → 调 handler → Response。",
      "Node routes 同样调 handler，用 better-sqlite3 与 local_kv 实现 Port。",
      "一次改一两个高价值接口（建议先 /api/config），不要一天迁完。",
    ],
    doneWhen: [
      "POST /api/config 的 id 重映射只存在于 shared。",
      "Functions 文件明显变短，不再出现第二份 QUOTA_CONFIG。",
    ],
    notThisPhase: ["不要统一 CF 与 Node 的 KV 键名", "不要上 ORM"],
    testFiles: [
      "tests/unit/ids.test.mjs",
      "tests/phase3/config-handler.test.mjs",
      "tests/phase3/dual-runtime.test.mjs",
      "tests/phase3/kv-key-compat.test.mjs",
    ],
    testCases: [
      {
        id: "P3-1",
        name: "id 重映射",
        how: "POST /api/config 两次提交相同 category.id / item.id",
        expect: "第二次写入的 SQL 主键与第一次不同；响应/再 GET 不出现 UNIQUE 500",
      },
      {
        id: "P3-2",
        name: "超配额拒绝",
        how: "普通用户提交 13 个分类或单分类 26 个书签",
        expect: "4xx，库中数据保持提交前快照",
      },
      {
        id: "P3-3",
        name: "双运行时同一 handler",
        how: "同一组请求打 Node :3000 与 wrangler preview（或 functions 的 handler 单测）",
        expect: "状态码一致；config 的 categories[].name / items[].url 集合相等",
      },
      {
        id: "P3-4",
        name: "KV 键名未统一",
        how: "断言 CF 适配器仍写 user_config:<uuid>，Node 仍写 local_kv/user_<uuid>.json",
        expect: "测试失败条件是「两边键名被改成同一种」；兼容是功能",
      },
      {
        id: "P3-5",
        name: "handler 无第二份配额",
        how: "rg QUOTA_CONFIG functions/ 与 src/server/",
        expect: "零命中定义；只 import shared",
      },
    ],
    accept: [
      "npm run test:phase3 与 test:dual 全绿。",
      "id 重映射的实现只出现在 nav-main/shared（rg remap 或等价函数名）。",
      "导入一份带旧 id 的 JSON 后，两端都能再保存成功。",
    ],
  },
  {
    id: "p4",
    name: "阶段 4 · 前端按功能拆模块",
    risk: "中",
    goal: "app.js 不再是唯一可改点；搜索补丁并回搜索模块。",
    steps: [
      "index.html 改为 <script type=\"module\" src=\"/assets/js/main.js\">。",
      "按现有函数块拆：boot、auth、render、search、sidebar、zen、notices、profile、idb-bg。",
      "每个模块暂时 Object.assign(window, { ... })，保证 inline onclick 仍可用。",
      "把 search-ux.js 合并进 features/search，删除「必须最后加载」的约定。",
      "user-manage.js 按 tab 拆 users / invitations / announcements / audit。",
      "升 ServiceWorker CACHE_NAME，避免旧 app.js 缓存把新模块打乱。",
    ],
    doneWhen: [
      "首页、登录、搜索首字符、禅意模式、拖拽排序、后台四个 Tab 行为与现在相同。",
      "app.js 不复存在，或只剩 re-export。",
    ],
    notThisPhase: ["不上 Vite/React", "不改视觉", "不重写 HTML 模板系统"],
    testFiles: [
      "tests/unit/sanitize.test.mjs",
      "tests/phase4/module-boot.test.mjs",
      "tests/e2e/smoke.spec.ts",
      "tests/e2e/search.spec.ts",
      "tests/e2e/admin.spec.ts",
    ],
    testCases: [
      {
        id: "P4-1",
        name: "入口是 type=module",
        how: "解析 index.html 的 script 标签",
        expect: "主入口为 /assets/js/main.js 且 type=module；不再依赖 search-ux.js 必须最后加载",
      },
      {
        id: "P4-2",
        name: "window 兼容桥",
        how: "在 jsdom/Playwright 里求值 window.showToast / closeAllModals / updateStyles",
        expect: "均为 function；inline onclick 用到的名字一张表列在 tests/fixtures/window-api.json",
      },
      {
        id: "P4-3",
        name: "搜索首字符",
        how: "E2E：焦点在页面时直接键入字母",
        expect: "搜索框出现且第一个字符被保留（原 search-ux 修复不得回归）",
      },
      {
        id: "P4-4",
        name: "引擎持久化",
        how: "E2E：切到百度，刷新",
        expect: "仍是百度，不被云端 settings 打回必应",
      },
      {
        id: "P4-5",
        name: "PWA 缓存版本",
        how: "读 ServiceWorker.js 的 CACHE_NAME，对比 git 上一版",
        expect: "字符串已升高；旧 app.js 不得再被 Precache",
      },
      {
        id: "P4-6",
        name: "导入清洗",
        how: "单测 sanitizeForExport / sanitizeForImport",
        expect: "去掉 user/role/quota/isAdmin；导入后分类与书签 id 全部换新",
      },
    ],
    accept: [
      "npx playwright test tests/e2e 全绿（桌面 1280 与手机 390 各跑 smoke）。",
      "test:phase4 全绿：window API 表、CACHE_NAME、不再加载独立 search-ux.js。",
      "手工：禅意开关、侧边栏钉住、拖拽一张卡片、后台四个 Tab 打开列表。缺一不可。",
    ],
  },
  {
    id: "p5",
    name: "阶段 5 · CSS 与 HTML 减负",
    risk: "中",
    goal: "改侧边栏不必在 5700 行里翻 Task 编号。",
    steps: [
      "按 tokens / reset / layout / sidebar / cards / search / modals / admin / responsive 切开。",
      "index.html 按序 link 这些 css，先 tokens 后组件。",
      "快捷键指南、帮助弹窗从 inline style 改成 class。",
      "大弹窗 HTML 可先留在 index.html；确认选择器稳定后再考虑 JS 模板。",
    ],
    doneWhen: [
      "亮/暗色、毛玻璃、移动端抽屉、管理模式高亮与现在像素级接近。",
      "桌面与手机各走一遍主路径。",
    ],
    notThisPhase: ["不引入 Tailwind 到导航站本体", "不改 densify 算法"],
    testFiles: [
      "tests/phase5/css-order.test.mjs",
      "tests/e2e/visual.spec.ts",
      "tests/e2e/responsive.spec.ts",
    ],
    testCases: [
      {
        id: "P5-1",
        name: "CSS 加载顺序",
        how: "解析 index.html link[rel=stylesheet]",
        expect: "tokens 在最先；不存在链式 @import 超过一层",
      },
      {
        id: "P5-2",
        name: "关键选择器还在",
        how: "对拆后 CSS 做选择器清单断言（sidebar / card / modal / zen）",
        expect: "tests/fixtures/css-selectors.json 里的选择器每个文件集合都能 grep 到",
      },
      {
        id: "P5-3",
        name: "主题与禅意",
        how: "E2E 截图：暗色首页、亮色首页、禅意模式、管理模式",
        expect: "与 tests/fixtures/screenshots/ 基线对比，diff 像素 < 0.3%（字体抗锯齿允许）",
      },
      {
        id: "P5-4",
        name: "移动端抽屉",
        how: "390×844：点汉堡，侧栏出现；点遮罩关闭",
        expect: "主内容不被永久挡住；搜索召唤按钮可点",
      },
    ],
    accept: [
      "test:phase5 全绿。",
      "视觉基线四张图通过（或经人工确认后更新基线并写明原因）。",
      "密度/卡片宽度滑块仍改变网格，不要求像素级动画一致。",
    ],
  },
  {
    id: "p6",
    name: "阶段 6 · SQL 单一权威",
    risk: "中",
    goal: "改表只动 migrations，其余生成或同源。",
    steps: [
      "PATCH_SQL 从 shared/schema-patch.js 导出，server 与 CF 共用。",
      "schema.upgrade.sql 由 PATCH_SQL 生成，或注明「复制自 schema-patch.js」。",
      "schema.sql / schema.console.sql 在改表 PR 里与 0000_init.sql 一起更新，checklist 写进 AGENTS.md。",
      "有余力再加 npm run sql:check 对比 CREATE TABLE 是否漂移。",
    ],
    doneWhen: [
      "加一列只改 migrations + 一份 PATCH 列表。",
      "老 D1 库仍能靠 upgrade / 热补丁起来。",
    ],
    notThisPhase: ["不要把 sql/ 拷进 Docker", "不要 DROP 重建用户表"],
    testFiles: [
      "tests/phase6/sql-source.test.mjs",
      "tests/phase6/old-db-upgrade.test.mjs",
      "tests/phase6/docker-no-sql-dir.test.mjs",
    ],
    testCases: [
      {
        id: "P6-1",
        name: "CREATE TABLE 对齐",
        how: "解析 migrations/0000_init.sql 与 sql/schema.sql 的建表语句",
        expect: "表名集合与列名集合相等",
      },
      {
        id: "P6-2",
        name: "upgrade 与 PATCH 同源",
        how: "抽出 schema.upgrade.sql 的 ALTER 与 shared/schema-patch.js 的 PATCH_SQL",
        expect: "列级 ALTER 集合相等（允许注释/空白差）",
      },
      {
        id: "P6-3",
        name: "缺列表能补上",
        how: "用一份故意去掉 users.email 的旧库 fixture 启动 Node",
        expect: "启动后 PRAGMA table_info(users) 含 email；接口不报 no such column",
      },
      {
        id: "P6-4",
        name: "sql/ 不进镜像",
        how: "Dockerfile 不得 COPY sql/",
        expect: "白名单仍是 package、src/server、migrations、nav-main",
      },
    ],
    accept: [
      "npm run test:sql 全绿。",
      "旧库 fixture 启动后注册/登录/读 config 成功。",
      "文档写明：改表 PR 必须同时改 migrations + PATCH；CI 跑 sql:check。",
    ],
  },
];

export const guardrails = [
  {
    title: "Pages Root 仍是 nav-main",
    detail:
      "控制台 Root directory = nav-main、输出目录 public、绑定名 nav / DB。共享代码必须放在 nav-main 内，否则 Pages 构建读不到仓库根的 src/。",
  },
  {
    title: "ikun.sh 留在仓库根",
    detail:
      "README 一键命令挂的是 raw.githubusercontent.com/.../v4/ikun.sh。挪路径等于让所有 VPS 用户的旧命令失效。",
  },
  {
    title: "不要统一 KV 键名",
    detail:
      "CF 用 user_config:<uuid>，Docker 用 local_kv/user_<uuid>.json。硬统一需要数据迁移。重构存储接口时把键名当作适配器细节，而不是「顺便改掉」。",
  },
  {
    title: "保留 POST /api/config 的 id 重映射",
    detail:
      "categories.id / items.id 是全局主键。导入和云端保存必须换新 id，否则 UNIQUE 冲突。这是功能，不是乱。",
  },
  {
    title: "不上 React / 不换构建链",
    detail:
      "导航站的卖点之一是改 public 即生效、Pages 无构建。用 Next 重写等于新项目，回归面覆盖不了现有交互。本仓库的 Next 只是方案说明书，不是 CloudNav 本体。",
  },
  {
    title: "镜像名与环境变量保持兼容",
    detail:
      "ghcr.io/alivedou/ikun_nav、容器名 ikun-navigation、卷 /app/local_kv、JWT_SECRET / CRON_SECRET / TELEGRAM_* 名称不变。Dockerfile COPY 白名单随目录调整，但运行契约不变。",
  },
];

export const features = [
  { group: "账号与权限", items: ["注册（首位即 admin）", "登录防爆破", "JWT", "角色配额", "邀请码", "临时密码"] },
  { group: "导航本体", items: ["分类 / 书签 CRUD", "拖拽排序", "显隐", "视频分类", "6 级图标降级", "魔棒抓元数据"] },
  { group: "个人化", items: ["密度 / 卡片宽度", "毛玻璃", "Bing 壁纸", "IndexedDB 大图", "亮暗色", "禅意模式"] },
  { group: "搜索与效率", items: ["多引擎搜索", "站内模糊检索", "键盘网格焦点", "常去", "分享只读页"] },
  { group: "云同步", items: ["KV+D1 双写", "导入导出清洗", "定时同步", "PWA Service Worker"] },
  { group: "管理后台", items: ["用户治理", "公告", "站点配置", "审计日志", "Telegram / 邮件告警", "日报 cron"] },
];

export const frontendSplit = [
  { file: "core/api.js", take: "fetch 封装、Authorization、401 处理" },
  { file: "core/storage.js", take: "localStorage 键、IndexedDB 背景图" },
  { file: "core/dom.js", take: "toast、loader、escapeHTML、debounce" },
  { file: "features/boot.js", take: "init()、站点配置、SW 更新" },
  { file: "features/auth.js", take: "登录 / 注册 / 登出 / 重置配置 / 管理员二次验证" },
  { file: "features/render.js", take: "buildCardHtml、renderNav、视频卡片" },
  { file: "features/search.js", take: "initSearch + 现 search-ux.js 补丁" },
  { file: "features/sidebar.js", take: "钉住、折叠、移动端抽屉" },
  { file: "features/zen.js", take: "禅意模式、唤醒导航" },
  { file: "features/notices.js", take: "公告中心、强提醒、已读" },
  { file: "features/profile.js", take: "个人资料、邮箱、TG" },
  { file: "features/sync.js", take: "现 cloud-sync.js" },
  { file: "features/theme.js", take: "现 theme-mode.js + personalization.js" },
  { file: "features/page-manage/", take: "现 page-manage.js，可再拆 drag / wizard" },
  { file: "features/admin/", take: "现 user-manage.js + sys-config.js，按 Tab 拆" },
];

export const apiParity = [
  "POST /api/auth/register",
  "POST /api/auth/login",
  "GET|POST|DELETE /api/config",
  "GET /api/bing",
  "GET /api/proxy/fetch-metadata",
  "GET /api/share",
  "GET /api/announcements  + POST /read",
  "GET|POST /api/user/profile",
  "GET|POST /api/admin/site-config",
  "GET|PATCH|DELETE /api/admin/users",
  "GET|POST|DELETE /api/admin/invitations",
  "GET|POST|PATCH|DELETE /api/admin/announcements",
  "GET /api/admin/audit-logs",
  "GET /api/admin/cron-digest",
];

export const testStrategy = {
  title: "测试不是收尾，是每个阶段的入场券",
  body: "v4 现在几乎没有自动化测试，只有一份手工 Docker 清单（docs/TESTING-REPORT.md）。重构如果还靠「点一点感觉没坏」，拆文件一定会静默回归。规则：先冻结基线，再改代码；阶段测试没绿，不允许进下一阶段。测试项目加在 CF-nav 仓库里，用 Node 22 自带的 node:test，前端阶段再加 Playwright。本说明书仓库不跑那些测试。",
};

export const testProjectTree = `CF-nav/
├── package.json                 # 增加 test / test:baseline / test:phaseN
├── tests/
│   ├── README.md                # 怎么跑、对哪套运行时
│   ├── fixtures/
│   │   ├── baseline/            # 阶段 B 冻结的 HTTP 快照
│   │   ├── route-map.json       # 允许的 method+path
│   │   ├── window-api.json      # 前端必须挂到 window 的名字
│   │   ├── css-selectors.json
│   │   ├── nav-export.sample.json
│   │   ├── old-db.sqlite        # 缺列的老库
│   │   └── screenshots/         # 阶段 5 视觉基线
│   ├── helpers/
│   │   ├── api.mjs              # 带 token 的 fetch
│   │   ├── reset-db.mjs         # 清空 local_d1.db + local_kv
│   │   └── dual.mjs             # 同一用例打 Node 与 wrangler
│   ├── baseline/
│   │   └── contract.test.mjs    # 每阶段都要跑的契约套件
│   ├── unit/                    # 不启服务器：quota / ids / sanitize / patch
│   ├── phase0/ … phase6/        # 只在对应阶段强制
│   └── e2e/                     # Playwright，阶段 4 起
└── .github/workflows/test.yml   # push 时跑 unit + baseline（Node）`;

export const baselineCases = [
  { id: "A-1", name: "游客读 config", expect: "GET /api/config → 200，带默认分类" },
  { id: "A-2", name: "匿名写 config", expect: "POST /api/config 无 token → 401" },
  { id: "A-3", name: "空登录体", expect: "POST /api/auth/login {} → 400，进程不崩" },
  { id: "A-4", name: "首位注册", expect: "空库 POST /api/auth/register → 200，role=admin" },
  { id: "A-5", name: "登录发 token", expect: "POST /api/auth/login 正确密码 → 200 + JWT" },
  { id: "A-6", name: "鉴权读 config", expect: "带 Bearer → 200" },
  { id: "A-7", name: "鉴权写 config", expect: "POST 合法书签 JSON → 200，再 GET 能读回" },
  { id: "A-8", name: "错误密码", expect: "401" },
  { id: "A-10", name: "Bing 壁纸", expect: "GET /api/bing → 200" },
  { id: "A-11", name: "用户侧公告", expect: "GET /api/announcements → 200" },
  { id: "A-12", name: "管理接口拒绝匿名", expect: "GET /api/admin/users 无 token → 403" },
  { id: "Q-1", name: "普通用户超分类配额", expect: "13 个分类 → 4xx，库不变" },
  { id: "I-1", name: "导出去身份字段", expect: "JSON 不含 user/role/quota/isAdmin" },
  { id: "I-2", name: "导入换新 id", expect: "categories/items 的 id 与文件内原值全不同" },
  { id: "D-1", name: "首页", expect: "GET / → 200，HTML 含导航壳" },
];

export const testCommands = [
  { cmd: "npm run test:baseline", when: "阶段 B 与之后每一阶段合并前" },
  { cmd: "npm run test:unit", when: "阶段 1 起，配额/补丁/id/清洗" },
  { cmd: "npm run test:phase0 … test:phase6", when: "只在对应阶段的 PR 强制" },
  { cmd: "npm run test:dual", when: "阶段 3 起，同一用例打 Node + wrangler" },
  { cmd: "npx playwright test", when: "阶段 4–5，浏览器回归" },
  { cmd: "npm run test:sql", when: "阶段 6，表结构对齐与旧库自愈" },
];

export const gateRule = [
  "阶段 B 的契约快照进 git。之后任何阶段如果 baseline 红了，先修回归，再谈拆文件。",
  "单测能覆盖的（配额、id 重映射、sanitize、PATCH_SQL）禁止只靠手工。",
  "双运行时从阶段 3 开始强制：只测 Node 绿、Pages 红，算没过。",
  "前端阶段 4 起必须有 Playwright smoke；搜索首字符、引擎刷新是必测，因为历史上就回归过。",
  "视觉对比允许更新基线，但 PR 说明里要写「改了什么外观」。无说明的截图更新视为失败。",
];

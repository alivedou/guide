> **可能过时**：本文是历史需求/规格，可能与现网实现有偏差。维护时以 [AGENTS.md](../AGENTS.md) 与代码为准。

# 项目需求文档 (Requirements Document) - CloudNav - V5 (双态稳定版)

## 1. 项目概述

CloudNav 是一款设计卓越、高颜值的**双态部署（Dual-Architecture）**多用户全功能个人导航与书签管理平台。本平台打破了传统静态导航的局限，专门打造了一套完美自适应的双轨运行架构：
1. **轻量 Serverless 边缘生态（Cloudflare Pages + Workers KV + D1）**：专为无服务器环境设计，部署于 Cloudflare 边缘计算节点，依靠高频分布式 Workers KV 承载偏好缓存、以分布式关系型 D1 关系数据库作为用户主体的强事务安全存储，实现全球毫秒级加速开屏与零基础设施运维压力。
2. **完全受控 VPS 容器部署（Node.js + Native SQLite3 + Docker）**：针对传统虚拟主机、自建 VPS 或群晖 NAS，系统提供了高一致性的 Node.js (Express) 备份引擎，将边缘 KV 和 D1 映射转换为高效率的文件型 SQLite3 (`better-sqlite3` 驱动) 和 `/local_kv` 本地 JSON 结构沙盒。

通过精简的前后端高度分离、对称式的模块化路由、优雅的轻量级流体毛玻璃美学和高硬度的安全限制网关，CloudNav 能够保障用户在任何环境下都能享受到毫秒级、0 白屏、多端完美一致的私人云端门户体验。

---

## 2. 核心目标
- **多租户安全隔离与精细配额（Multi-Tenant Isolation & Quota Barrier）**：通过严格的物理底层租户 ID 绑定实现严密的隔离，根据用户角色（游客、普通、特权、管理员）实行差异化资源配额以及最高危操作的大一统 Promise 阻断审计机制。
- **自愈式通知与多级日报审计流（Self-Healing Daily Digest Tracker）**：内置对齐的 Cron-Digest 触发路由。无论是运行在 Cloudflare Cron Triggers 中，还是被部署在 VPS 上的外部定时任务拉取，均可凭 `x-cron-secret` 安全校验穿透，自动打包最近 24 小时增量日志，并通过 Resend 触发多邮件分发、或通过 Telegram Bot 自动推送全球通知或个人电报，使系统自愈具备完整反馈。
- **单视图隔离检索（Isolated View Portal）**：将传统分类长滚动布局与全新的“单一分类隔离渲染”深度融合，在“长页纵览”与“单卡片沉浸”中快速穿梭，通过弹性密度选项（紧凑、标准、透气）自适应各类屏幅。
- **全键盘导向操作（Full Keyboard-Driven Accessibility）**：针对重度键盘用户提供全场景、全链路的键盘无障碍导航体验，无需鼠标即可完成导航跳转、模糊搜索、偏好切换及后台配置修改。

---

## 3. 技术栈与系统架构

### 3.1 核心技术栈 (Core Tech Stack)

- **前端 (Frontend)**：原生 HTML5、CSS3 (双核自适应、流体毛玻璃、非对称比例网格) 和原生 JavaScript (Vanilla JS，零重型框架损耗，保障极致的首屏指标)。
- **平行后端运行态（Dual Backends）**：
  - **边缘运行时 (Edge Serverless)**：Cloudflare Pages Functions（遵循统一的中间件权限控制、CORS 头及 API 流控规范）。
  - **Node.js 运行时 (Private VPS)**：Node.js 22 LTS 运行环境 + 轻量级 Express 生态，承载 API 与静态文件挂载。
- **双模存储映射（Storage Layer Translation）**：
  - **关系型主数据库**：
    - *Serverless 环境下*：**Cloudflare D1**，分布式云 SQL。
    - *VPS 私有环境下*：**SQLite3** 实机物理数据库（选用 Native C++ 编写的高效率、高吞吐 `better-sqlite3` 驱动），支持应用启动时自动执行 SQL 迁移（Migrations）补缺。
  - **高性能键值存储 (KV Engine)**：
    - *Serverless 环境下*：**Cloudflare Workers KV**（偏好配置、网站元信息高频分发层）。
    - *VPS 私有环境下*：**`/local_kv` 本地 JSON 数据沙盒引擎**（完美映射 KV API 操作）。
- **边缘安全与推送兼容套件**：
  - **jose**：基于 Edge Compute 加密标准的 JWT 安全签名核验。
  - **Resend** & **Telegram Bot API**：集成原生跨平台 HTTP 异步调用接口，用作双态下自检日报与告警系统的底层传输介质。
- **第三方核心前端组件**：
  - **SortableJS**：前端网址/分类跨屏物理重排引擎（Drag & Drop）。
  - **Monaco Editor**：专供“高级专家模式”的 JSON 导入与数据恢复编辑中心，支持全语法着色与实时格式纠错自愈。�


### 3.2 数据库 Schema 架构设计 (D1 关系型存储)

系统在 D1 关系型持久化层定义了严密的表结构体系。详细设计 with 字段约束如下：
#### 3.2.1 用户主表 (users)

存储用户的核心账户凭证、角色标签及注册属性。

- `id` (TEXT PRIMARY KEY) ：用户的全局唯一、不可变账户 UUID。
- `uid` (INTEGER UNIQUE) ：系统内更友好的自增数字 ID。首席管理员（Root Admin）固定提拔 UID 为 `10001`（系统首位注册用户），后续用户依次自增。
- `username` (TEXT UNIQUE NOT NULL) ：登录用户名，支持中英文字符、数字，注册时需进行碰撞和敏感禁词校验。
- `password_hash` (TEXT NOT NULL) ：经 SHA-256 安全加盐哈希 of 密码凭证。
- `role` (TEXT DEFAULT 'user') ：角色标识。可选值有 `user`（普通用户）、`invited`（邀约用户）、`super_user`（超级用户）、`admin`（管理员）。
- `email` (TEXT) : 用户绑定的通知邮箱地址（可选）。
- `avatar` (TEXT) : 自定义头像链接或字形、头像标识（可选）。
- `telegram_chat_id` (TEXT) : 多态个人电报通知接收 ID（可选）。
- `has_invite` (BOOLEAN DEFAULT 0) ：是否通过邀请码注册。
- `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP) ：注册时间。
- `last_login` (DATETIME) ：最近一次成功登录时间。

#### 3.2.2 用户偏好设置表 (user_settings)

持久化存储用户的视觉主题、搜索引擎、毛玻璃程度、自适应、通知设置及布局参数。

- `user_id` (TEXT PRIMARY KEY, FOREIGN KEY REFERENCES users(id)) ：关联用户唯一 ID。
- `layout_density` (TEXT DEFAULT 'standard') ：密度布局参数（`compact` 紧凑 / `standard` 标准 / `comfortable` 舒适）。
- `search_engine` (TEXT DEFAULT 'google') ：默认搜索引擎。
- `bg_blur` (INTEGER DEFAULT 15) ：自定义背景高斯模糊深度参数。
- `bg_url` (TEXT DEFAULT '') ：背景图片 URL 指针，“本地 Base64 离线缓存”指针写为 `local_upload`。
- `theme_mode` (TEXT DEFAULT 'auto') ：主题跟随状态（`auto` 自动 / `dark` 纯黑 / `light` 亮白）。
- `link_target` (TEXT DEFAULT '_blank') ：网址跳转模式（`_blank` 新页面 / `_self` 当前页）。
- `is_alert_receiver` (BOOLEAN DEFAULT 0) : 是否接收即时安全通知告警。
- `is_digest_receiver` (BOOLEAN DEFAULT 0) : 是否接收每日审计汇总日报。

#### 3.2.3 分类表 (categories) 与网址项目表 (items)

构建高度可配置的层级关联，支持视频模式自适应与跨租户级联清理。

- `categories`：存储分类的容器。包含 `id`、`user_id` (外键关联)、`name` (分类名称)、`icon` (图标标识/Emoji)、`sort_order` (排序索引)、`is_video` (是否启用视频卡片自适应抓取模式)、`hidden` (是否隐藏分类)。
- `items`：挂载于分类下的具体卡片。包含 `id`、`user_id`、`cat_id` (外键级联删除)、`title` (卡片标题)、`url` (跳转地址)、`desc` (说明描述)、`icon` (图标地址/自定义字形)、`bg_color` (卡片磨砂背景色彩参数)、`sort_order`、`hidden`。

#### 3.2.4 公告主表 (announcements) 与已读状态关联表 (announcement_read_states)

支持多端同步消除红点及顶部 Banner 悬浮的公告存储矩阵。

- `announcements`：包含 `id`、`creator_id`、`title`、`content`、`type` (公告层级：`quiet` 静默通知 / `important` 顶部 Banner 重要通知)、`status` (草稿 `draft` / 已发布 `published` / 已归档 `archived`)、`is_top` (是否置顶)、`created_at`、`expire_at` (定时过期时效)。
- `announcement_read_states`：核心关联表。联合主键 `(user_id, announcement_id)`，用于在多用户状态下，记录并对齐各个已登录用户对全局公告的已读或主动关闭时间，不打扰多端已读体验。

#### 3.2.5 邀请码表 (invitation_codes) 与安全审计日志表 (audit_logs)

- `invitation_codes`：包含 `code` (主键)、`creator_id`、`used_by`、`status` (`unused` 未使用 / `used` 已使用)、`created_at`、`used_at`。
- `audit_logs`：自动强制记录管理员 or 特权用户执行的高危行为。包含 `id`、`user_id`、`action` (操作动作)、`details` (变更详情 JSON 备份)、`ip` (操作人来源 IP 地址)、`created_at` (UTC 时间戳)。

### 3.3 后端 API 路由树与双态目录映射 (Backend API & Dual-State Directory Mapping)

为保障双态运行（Serverless 边缘节点与 VPS Node.js 容器）下的 API 路径、权限网关及逻辑高度对称，系统的后端架构采用“同构路由映射”设计。前端无论请求哪个环境，均指向统一的 `/api/*` 命名空间。

#### 3.3.1 全局物理目录对齐
- 📂 `/nav-main/public/` ：存放全静态前端界面、PWA Manifest、Service Worker 及客户端 JS/CSS 资产，无论哪种部署形态均作为应用唯一的加载静态源。
- 📄 `/Dockerfile` ：完全受控 VPS 方案的容器化启动层，基于 Alpine 镜像构建，预装完整的 Node.js 环境并代理 SQLite 驱动底层依赖项。

#### 3.3.2 边缘与单体 VPS 路由树映射矩阵
Cloudflare Pages 依靠 `/nav-main/functions/api/` 目录下的层级物理文件系统动态映射，实现 Serverless 路由执行点分流；而 `server.js` 则直接使用 Express Router 绑定将同等路由路径一一挂载为本地进程实例。两者严格对照映射如下：

| 功能模块 (Function) | Serverless 路由节点 (`/nav-main/functions/api/*`) | 单体 Node.js 等效挂载 (`/server.js`) |
| :--- | :--- | :--- |
| **全局请求拦截与鉴权限制** | `_middleware.js` | `app.use(express.json())` & `authenticate` 中间件 |
| **个性化配置加载/更新同步** | `config.js` | `app.get/post/delete('/api/config')` |
| **默认出厂及积木数据模板** | `defaultData.js` | 同构常量 / `server.js` 内部静态数据声明层 |
| **Bing 每日高清壁纸拉取代理** | `bing.js` | `app.get('/api/bing')` |
| **书签网页元数据智能解析抓取** | `proxy/fetch-metadata.js` | `app.get('/api/proxy/fetch-metadata')` |
| **游客侧只读系统公告查询** | `announcements.js` | `app.get('/api/announcements')` |
| **登录态公告同步标记消除红点** | `announcements/read.js` | `app.post('/api/announcements/read')` |
| **页面安全分享与公开数据导出** | `share.js` | `app.get('/api/share')` |
| **用户登录鉴权与 JWT 票据下发** | `auth/login.js` | `app.post('/api/auth/login')` |
| **注册中心体系与防刷容量自检** | `auth/register.js` | `app.post('/api/auth/register')` |
| **个人安全名片换绑与面板更新** | `user/profile.js` | `app.get/post('/api/user/profile')` |
| **管理员：全局站点参数与风控配置**| `admin/site-config.js` | `app.get/post('/api/admin/site-config')` |
| **管理员：核心用户检索与冻结重置**| `admin/users.js` | `app.get/delete('/api/admin/users')` |
| **管理员：全局重要与静默公告分发**| `admin/announcements.js` | `app.get/post/delete('/api/admin/announcements')` |
| **管理员：防滥用邀请及配额账单跟踪**| `admin/invitations.js` | `app.get/post/delete('/api/admin/invitations')` |
| **管理员：多维高危越权审计日志溯源**| `admin/audit-logs.js` | `app.get('/api/admin/audit-logs')` |
| **定时自愈：多通道自愈安全审计日报**| `admin/cron-digest.js` | `app.get('/api/admin/cron-digest')` |

上述同构体系不仅保证了系统底层可以完全脱离容器依托、借助 Cloudflare 高频生态系统内独立物理文件驱动执行；还能让任何兼容 Node.js + Docker 的单体 VPS 等效平替全部路由结构，完全对外暴露相统一的 JSON 接口网关。

---

## 4. 功能列表与详细规约

### 4.1 核心搜索与导航模式

#### 4.1.1 双模导航形态 (Dual Navigation Modes)

- **极简沉浸模式 (Zen Mode)**：
  - **UI 呈现**：开屏启动时，仅在屏幕正中央高亮显示一个聚焦式 Spotlight 风格搜索框，侧边栏分类导航及网址网格全部强制隐藏。
  - **平滑切入**：当用户产生交互（鼠标微幅移动、点击、键盘任意有效敲击）时，页面将以毫秒级非线性过渡动画平滑向下展开导航分类，唤醒“导航视界”。
  - **单分类隔离渲染**：在沉浸模式下默认开启，仅展示首位分类。后续点击侧边栏新分类，均严格在当前卡片区域替换渲染对应书签，杜绝长页面滚动导致的杂乱感。
  - **快捷调度**：桌面端支持通过键盘快捷键 `Ctrl/Cmd + B` 或双击空白区域快速切入/退出沉浸模式；移动及平板端额外支持从屏幕左边缘向右拖拽的边缘划动手势弹出分类抽屉栏。

- **常规模式 (Standard Mode)**：
  - 侧边栏分类常驻全视角左侧，右侧以传统宽容网格布局展示所有分类和挂载的书签。

#### 4.1.2 常去网站智能生成机制 (Smart Frequent Sites)

- **动态判定策略**：前端全自动监测并统计用户在最近 7 个日历日内对所有导航书签卡片的点击跳转频次。当某一网址项在近 7 日内点击数累计 $\ge 10$ 次时，系统底层逻辑自动将其标记为高频资源，并归集渲染于导航首位的“常去网站”独立窗格内。
- **绝对自动托管**：此板块属于系统自愈及自我生成的全自动流转模式，不允许用户手动在前端执行强制置顶、手动增减或长久锁定绑定操作，实现真正的点击数据驱动体验。

#### 4.1.3 检索排布与流体一体化面板 (Spotlight Unified Panel)

- **键入即唤醒**：在页面任何非焦点状态下，直接敲击键盘任何英文字母键即可无缝聚焦到搜索输入框，无需鼠标定位。
- **平滑流体圆角咬合**：
  - 聚焦输入框面板外侧容器 `.search-wrapper` 默认圆角为 28px 药丸形。
  - 当键入字符拉出本地/联想站内搜索匹配项下拉列表 `.search-dropdown` 时，输入框底部的圆角自动抹平为 0，与其下方的毛玻璃磨砂下拉层（设计尺寸：背景色 `rgba(15, 25, 35, 0.82)`，高斯模糊滤镜 `blur(25px)`，底部圆角 28px）实现无空隙无缝接轨拼接，营造出类似 Apple Spotlight 的高档整体磨砂咬合视觉面板。
- **本地搜推与跳转对齐**：检索逻辑优先在前端缓存中检索当前用户的本地分类及书签项目。匹配成功后支持利用键盘 `↑` `↓` 键平滑流转焦点。当敲击 `Enter` 时触发跳转，跳转动作（新页面打开或当前页覆盖）严格与用户偏好中的 `link_target` 设置实时对齐并自适应生效。

---

### 4.2 页面管理与个性化 (Page Management)

#### 4.2.1 内容偏好与管理模式智能降级

- **内容偏好选项**：
  - **网格尺寸与卡片高度锁死**：规范卡片默认垂直高度为 105px，标题行数限制放宽为两行（`-webkit-line-clamp: 2`，`line-height: 1.25`，卡片内 `min-height` 锁死在 `2.5em`）。确保无论标题是一行还是两行，网格中的所有卡片高度、图标对齐依然整齐划一，拒绝错位。
  - **宽容动态栅格**：排版密度支持三档可调：紧凑（85px，追求信息内容装载极限）、标准（105px，体验均衡基点）、舒适（120px，强透气感、舒适视觉比例）。
  - **自动壁纸与简约模糊**：可选择拉取 Bing 每日高清壁纸（内置半透明遮罩与 24h 边缘缓存，消除由于壁纸过亮导致的文字阅读障碍），或输入网络壁纸 URL 及纯色，并能对背景调节高斯模糊程度。
- **管理模式对沉浸禅意的智能降级与锁定**：
  - **自适应悬挂**：当用户在极简沉浸“禅意模式”下，一旦点击进入“页面管理”面板，系统自动执行样式判断，**临时悬挂并隐退“禅意模式”特定样式与布局**（临时置 `isZen = false`），瞬时恢复至常规长网格模式，保障全站分类卡片的拖拽重排与编辑可用性。
  - **防背景沉睡锁定**：当用户正在页面管理面板中，或打开了任何专家模式 JSON 编辑器、设置弹窗时，**静默睡眠定时器会被强制锁死并暂停**。防范在编辑长配置的过程中页面突然“睡死”（如壁纸变暗、侧边栏消失），直到点击保存退出或关闭弹窗后，自动平滑返场，返还沉浸姿态。

#### 4.2.2 零服务器流量开销的“本地自定义高清壁纸上传”与缓存渲染

- 为了规避多用户上传壁纸对 Cloudflare D1 存储库造成的容量膨胀，以及对 Serverless API 造成的外发高昂带宽流量，系统研发了非对称式“**Base64 离线缓存 + 云端极简指针占位**”架构。
- **本地 Base64 存储 (升级为 IndexedDB)**：当用户在视觉选项中点击上传本地壁纸时，前端限制图片文件由原先的 $3\text{MB}$ 放宽至 $\le 10\text{MB}$。在浏览器沙盒中将其读取并转换为压缩的 Base64 DataURL 之后，**不使用极易产生容量溢出的 `localStorage`，而是写入超大空间的 `IndexedDB` 存储库中**（解决传统 5MB `localStorage` 的 `QuotaExceededError` 额度崩溃 Bug）。
- **向后兼容与迁移**：系统启动时自动检测老用户本地 `localStorage`，平滑、无缝、自动地将其迁移至新一代 `IndexedDB` 存储中，并自动释放 `localStorage` 的空间占用。
- **非阻塞预加载**：采用异步预加载 `initLocalBgImage()` 并缓存在全局变量 `window.navLocalBgImage`，完美解决 `updateStyles` 同步刷新背景样式时因数据库查询导致的闪烁、白屏和延迟问题。
- **云端指针同步**：在用户保存配置进行云端 D1 同步时，用户的偏好设置中 `bgUrl` 仅会被写入微小的标记指针字符串（`local_upload`，仅占用 12 字节），服务器产生 $0$ 服务器空间和流量消耗，且本地持久化极度稳健，强制刷新不丢失。

#### 4.2.3 页面内容可视化重排与批量管理

- **可视化 Page Management 套件**：开启后全站卡片进入可视化非线性编辑状态。
  - **SortableJS 丝滑排序**：网址卡片可在不同分类卡片网格间拖拽跨视图重排（Drag & Drop）；侧边栏分类亦支持拖拽调整上下顺序。分类卡片拖放需通过专用把手触发，规避日常浏览误触。
  - **网址窗格批处理**：在管理套件开启状态下，卡片左上角显示勾选框。支持一次选中多个网址窗格卡片，从底部弹出的半悬浮批处理栏中，执行一键“批量迁移至指定分类”或“批量一键物理删除”。
  - **智能入口与魔法棒（Smart Fetch）**：
    - 分类卡片网络末项挂载“+ 新增网址”的虚线点状辅助框，点击弹出新建侧拉页。
    - 编辑网址时提供“魔法棒图标智能获取”功能：一键向后端发送 URL，智能依次尝试抓取（网站根目录标准 Favicon -> 内置 CDN 精品图标库 -> 首字母高亮字形兜底），提供秒级图标填充。

#### 4.2.4 导入/导出与配置自愈 (Reset)

- **数据导入与导出**：支持一键将当前用户的所有分类、网址及视觉偏好序列化导出为本地 JSON 配置文件（格式为 `[UID]_[月份][日期].json`）。
- **第三方转换友好引导**：**由于系统底层的分类和网址采用强定制的关系型 JSON 标准形式，为保证系统解析的事务安全性，不接受非标准结构的导入。本网页强定制系统的专属导入格式底层结构锁定不可更改。面对日常多见浏览器书签导入需求，系统将在功能弹出项处与项目开源 README 文件中友情提供通用的第三方格式在线转换辅助跨界桥梁工具链接，强烈引导使用者务必自行采用它界外辅助工具完成书签链结至系统原生 JSON 标准形态的翻译转换加工手续后且复行系统本身的标准引入流转。**
- **默认出厂状态自愈 (Reset)**：提供“恢复默认”入口，强制以 D1 系统初始化模板（对应首层 KV 或只读的 `nav-main/functions/api/defaultData.js`）覆盖现有配置。

---

### 4.3 账号体系与基于角色的权限控制 (RBAC)

#### 4.3.1 多级用户角色及权限功能矩阵 (RBAC Matrix)

系统内置从游客到最高首席管理员的五级鉴权保护链路。权限分配如下：

| 功能模块 | 游客 (Guest) | 普通用户 (User) | 邀约用户 (Invited) | 超级用户 (Super User) | 管理员 (Admin) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **基础导航浏览** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **页面管理** | ✅ (仅本地) | ✅ (云端) | ✅ (云端) | ✅ (云端) | ✅ (全站) |
| **个性化设置** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **云端备份/同步** | ❌ (引导登录) | ✅ | ✅ | ✅ | ✅ |
| **资源限制配额 (分类/网址)** | $6 \ / \ 12$ | $12 \ / \ 25$ | $15 \ / \ 30$ | $20 \ / \ 40$ | $150 \ / \ 500$ |
| **用户管理中心** | ❌ | ❌ | ❌ | ✅ (受限) | ✅ (全量) |
| **系统参数配置** | ❌ | ❌ | ❌ | ❌ | ✅ |

#### 4.3.2 首席管理员 (Root Admin) 终极机制

- **Root 身份锁死**：系统单独设立首席管理员机制，用于解决常规管理员之间越权降级或滥用超级账号的问题。系统物理层约定，首位注册且自动提拔的管理员（内部 UID 为 `10001`，或 ID 唯一识别为 `1` 的账户）为本站终身唯一首席管理员。
- **特权专享**：仅有 Root Admin 在登录后台后能对其他用户赋予 `admin` 角色 or 撤销现有 Admin。普通的 Admin 在后台仅能修改用户为 `super_user` / `user`，该授权选项对普通 Admin 隐藏。
- **降级防卫**：任何人都无法在后台修改、撤销或冻结 Root Admin 的权限与账户状态，确保站点所有权的终极安全。

#### 4.3.3 管理员日常权限与名额限制 (Admin Policy)

- **管理员数量硬上限**：系统为防范权限外溢或因数据库泄漏造成的恶意 Admin 泛滥，设定全站 Admin（不含 Root）的注册或提拔数量上限为 5 人。达到此限额后，任何管理员尝试赋予新用户 Admin 角色都会被后端 API（对应 [nav-main/functions/api/admin/users.js](nav-main/functions/api/admin/users.js#L110)）拦截。
- **账号冻结机制 (Account Freeze)**：
  - **即时阻断**：一旦执行冻结操作，后端安全拦截器将立使该用户的所有当前活跃 Token 失效（在中间件 [nav-main/functions/api/_middleware.js](nav-main/functions/api/_middleware.js#L29) 级物理阻断），禁止任何新的登录、同步或数据读取尝试。
  - **数据保留**：冻结仅限制登录 and 写入，系统不会物理抹除其分类、书签等核心配置，以便在解冻时一键无缝恢复。

#### 4.3.4 高危操作安全核验与大一统复用机制 (High-Risk Re-Auth & Modal Reuse Spec)

- **高危操作精确定义**：全站后台凡涉及敏感安全授权、数据篡改、破坏性清空以及重大配置还原的特权操作，均属于系统级最高危行为，系统强制执行高强度的二次安全密码核验。其范围严格包括：
  1. **变更角色权限**：提拔普通用户为 `admin` / `super_user`，或对其降权。
  2. **修改安全状态**：冻结、解冻特定账户的安全阻断设置。
  3. **账户密码强制改写**：管理员强制为其他注册用户修改、重置登录凭证密码。
  4. **物理删除彻底销号**：删除某一注册用户及其所有的云端 D1 网址、分类数据，此操作一经下发不可逆转。
  5. **恢复出厂设置**：全站参数重设，一键抹除管理员在云端及本地存储的全部当前设置。
- **大一统高复用子核验模态窗**：
  - **100% 结构复用与 0 开销**：全站彻底淘汰原先明文暴露密码且视觉撕裂的浏览器原生 `prompt()` 对话框，在 `index.html` 中静态追加高优先级二次验证子模态弹窗 `#admin-auth-modal`（`z-index: 11000`）。该弹窗 **100% 共享、复用了大后台中现成的磨砂玻璃质感、1px 细虚线边框、`.modal-content` 容器及自适应主题配色**，不仅实现了 0 字节 CSS 开销、卓越的安全性，更达成了全后台像素级的视觉闭环。
  - **密码隐蔽防肩窥**：输入框采用标准的 `<input type="password">` 密码掩码安全防护，彻底避免密码泄密。
  - **高阶 Promise 异步安全拦截器**：前端底层封装通用拦截网关 `window.requireAdminAuth(message)` 异步 Promise 对象。高危点击触发时无缝挂起、自锁当前上下文，等待管理员输入正确的密文后方可将密码下发给 D1 安全事务，实现了零冗余、低开销的模块化高复用核验设计。

---

### 4.4 系统管理与全量审计 (System Administration)

#### 4.4.1 系统全局配置 (System Configuration)

仅允许 `admin` 级别的账号修改。配置落库 D1 并推回 Workers KV 快速分发，实现全站毫秒级感知：

- **全局站头元数据 (Site Metadata)**：支持直接修改全站的标题（Title）、SEO 关键字（Keywords）、SEO 描述（Description）、站点头部 Logo 路径以及首层 Favicon 的在线加载地址。
- **注册与邀请准入策略**：支持系统级的开关配置：
  - **开放式注册 (allowOpenRegistration)**：是否允许游客直接注册。
  - **仅邀请码注册 (requireInvitation)**：是否开启邀请码校验限制。首位注册用户自动绕过所有规则（初始化为首位 Root Admin），之后的用户依据此规则强制校验 [migrations/0001_invitations.sql](migrations/0001_invitations.sql)。
- **超管每日配额管理**：设置 `super_user` 每日可生成的合法邀请码限额上限，阻断批量滥刷。
- **时区与多语言环境**：指定系统运行的语言包及默认时区（默认：`Asia/Shanghai`）。

#### 4.4.2 审计日志体系 (Audit Logs)

在管理员控制面板可查询全站的历史高危日志。系统会物理拦截并保存：

- 每一项管理层级的角色授权变更、密码强制重置、账号冻结、物理删除及全局 site-config 修改。
- 日志字段强制包含：操作发起人、操作具体动作、目标被操作人、执行时间戳、管理员来源 IP（通过 Cloudflare Edge Header 的 `CF-Connecting-IP` 属性抓取）。

---

### 4.5 公告中心与多端同步 (Announcement & Sync)

#### 4.5.1 多端同步已读状态公告

- **游客态（未登录）处理分流**：
  - 游客端通过 [nav-main/functions/api/announcements.js](nav-main/functions/api/announcements.js) 读取有效的公开公告。由于游客不存在物理 D1 主键，游客态的公告未读小红点 `unreadCount` 恒等于有效公告总量，红点永久展示，刺激其进行注册。
  - 顶部重要横幅 (Banner) 提供 `×` 临时关闭，但关闭状态**不写入 LocalStorage 持久化**。刷新或换端浏览器打开时横幅依旧强制呈现，点击关闭时向游客弹出温馨引导注册提示语。
- **登录态（已登录）多端完美同步**：
  - 登录用户阅读公告、或点击关闭顶部横幅时，前端即时调用 `/api/announcements/read` 接口，D1 会在 [migrations/0002_announcement_read_states.sql](migrations/0002_announcement_read_states.sql) 中落库一条该用户对该公告的已读状态。
  - 已读状态全局生效。用户在 PC 端关闭公告后，手机、平板或异地登录在重新渲染时都会通过 D1 联表计算，精准物理对齐消除未读红点及顶部 Banner，防止逆向数据多次骚扰用户。

#### 4.5.2 时区对齐网关与 UTC 零时差 Bug 自愈

- **UTC 数据库存储**：系统底层 SQLite/D1 数据库中利用 `CURRENT_TIMESTAMP` 存储的所有时间、创建及最后登录时间均为绝对无时区修饰的 UTC 零时区时间戳格式（如 `2026-05-31 12:00:00`）。
- **前端注入时间戳网关 (`window.parseUtcDate`)**：为彻底解决某些浏览器原生在直接使用 `new Date()` 格式化无时区字符串时产生的 8 小时时差 Bug，全站在公共底层注入 `window.parseUtcDate` 时间戳安全对齐网关：
  - 接收到后端传来的无时区 UTC 字符串时，自动检查并在尾部补齐标准的 ISO `T` 字符与 `Z`（Zulu，世界协调时零时区）标识。
  - 解析后的 Date 实例，依据用户的 `user_settings` 中配置的时区（如 `Asia/Shanghai`）自适应对齐渲染为最精准的时间显示。

---

### 4.6 数据同步、动态资源配额与高阶非阻塞架构

#### 4.6.1 数据加载之 Stale-While-Revalidate（缓存秒开 + 异步校验）

为了应对复杂的多租户网络白屏，极致优化访问路径响应，系统研发了双流数据异步自愈秒开机制：

1. **零延时秒开**：页面触发加载时，优先拉取浏览器中的 `localStorage` 缓存结构进行全站 DOM 重绘渲染，无论此时网络状况如何，皆可实现接近 0 毫秒的开屏效果。
2. **游客本地沙盒隔离**：检测到为未登录游客态，且检测到本地已经存有脏数据配置（LocalStorage 内不为空）时，页面直接拦截并免去网络 fetch `/api/config` 步骤，绝不让服务器全局初始化模板覆盖、抹杀游客辛苦建立的本地沙盒数据。
3. **云端异步校验与无感静默更新**：
   - 登录状态下，通过本地缓存秒开完成后，浏览器在后台非阻塞、静默地向云端 Workers KV/D1 异步发起最新 `/api/config` 获取请求。
   - 拿到云端数据后，利用高效比对函数（`getCoreDataFingerprint` 差异指纹算法）计算两端核心数据的哈希值。若本地与云端指纹哈希完全一致，则静默保持当前 DOM 不动；若另一台异地设备修改了配置（导致指纹不符），则静默将云端最新配置写入本地 LocalStorage 并直接就地静默重绘局部网址与分类视图。
   - 由此，既拥有了纯本地存储的极限开屏速度，又达成了跨端多平台秒级数据的最终一致性（Eventual Consistency）。

#### 4.6.2 动态物理资源配额拦截器 (Quota Guard)

- **多维度限制配额**：
  为避免大量用户导入、滥建网址引起 D1 关系型存储容量溢出甚至遭到拒绝服务攻击（DoS），系统强制执行阶梯等级配额控制（通过 [nav-main/functions/api/config.js](nav-main/functions/api/config.js#L13) 后端严格执行）：
  - **游客 (Guest)**：6 分类 / 12 书签配额上限。
  - **普通用户 (User)**：12 分类 / 25 书签配额上限。
  - **邀约用户 (Invited)**：15 分类 / 30 书签配额上限（通过邀请码注册提拔的用户，享受更高规格 of 物理福利上限）。
  - **超级用户 (Super User)**：20 分类 / 40 书签配额上限。
  - **管理员 (Admin)**：150 分类 / 500 书签配额上限。
- **后端 API 强校验物理拦截**：当用户试图通过修改前端代码或者直接利用 API Post 发送超限的 JSON 时，后端 [nav-main/functions/api/config.js](nav-main/functions/api/config.js#L138) 在接收到请求后立即执行物理配额审查。若 categories 数量或单分类下 item 数量超标，直接下发 `403 Forbidden` 并附带标准规范代码 `ERR_QUOTA_EXCEEDED`。同时在配置获取的 Get 头中加入强抗缓存标记 `no-store, no-cache` 消除一切边缘代理缓存绕过的可能。
- **本地 Node 开发服务器 (server.js) 对齐**：本地开发环境测试服务器 [server.js](server.js) 完全移植了与生产环境一模一样的 `QUOTA_CONFIG` 机制，摆脱了以前硬编码固定限制的束缚。通过 SQLite 数据库关联动态计算 `getQuota`，让本地开发和调试（如管理员上限为 100/500）能与需求文档及线上生产环境 100% 精准对齐。
- **前端提前预阻断**：前端在每次检测到渲染后，动态统计分类及网址用量。如果当前数量接近或等于配额上限，自动禁用新增入口，并在添加栏实时渲染极简用量比进度指示条（如 `8/8` 满了），防患于未然。

#### 4.6.3 新用户初始化与克隆流转

- **开箱即用初始化**：当新用户首次完成注册并首次拉取主页时，系统会在 D1 / KV 拦截层进行全自动“无配置自愈”：
  - 优先向后端读取是否存有全局统一推荐 onboarding 默认模板。
  - 若模板加载不存在，则全量拷贝系统只读的内置静态数据源（`nav-main/functions/api/defaultData.js` 中的主数据结构），自动为该新账户建立 D1 行内分类与书签，使用户一注册就拥有极高美学、开箱即用的预设页面。

#### 4.6.4 防刷、防爆破与速率限流 (Anti-Abuse)

- **写操作 Debounce 防抖**：由于跨分类拖放和高频修改会带来 D1 的密集读写开销，前端所有页面布局修改在保存时，均内置 500\\text{ms} 的写操作防抖（Debounce）及批量打包提交机制，将琐碎的拖拽修改整合为单一 D1 批量批处理查询执行。
- **IP 登录级限流与密码爆破阻断**：在 API 鉴权入口针对异常请求设定：同一 IP 地址 10 分钟内若连续登录失败达到 5 次，系统自动拒绝该 IP 10 分钟内的所有访问尝试，并对管理员审计日志实时记账。

---

### 4.7 跨端融合与视觉一致性 (Cross-platform)

- **标准 PWA 级纯物理融合**：前端构建完全兼容标准的 PWA 离线运行机制，配置完备 of [nav-main/public/manifest.json](nav-main/public/manifest.json) 与 [nav-main/public/ServiceWorker.js](nav-main/public/ServiceWorker.js)，支持移动、桌面全操作系统端“添加到主屏幕”，赋予其完美独立、高对比度、无边框沉浸的客户端独立运行体验。
- **亮暗主题一致性**：所有视觉颜色（包括卡片背景、高斯模糊、模态遮罩、侧边抽屉及文字前景）均采用无死角的 WCAG A+ 级色彩对比度配比，自适应浅色与深色，在极端壁纸或极限低亮度下依旧保障字迹具有 $100\%$ 的清晰可读性，消灭视觉噪点。

---

### 4.8 代码规范与著作权声明 (Code Specifications)

- **全局注释注入规范**：全站所有核心后端 Express 服务脚本、Serverless 路由函数以及公共前端工具、逻辑控制脚本在头部必须有统一的作者及免责声明注释：
  ```javascript
  /**
   * @fileoverview 
   * @author adou
   * @copyright Copyright (c) 2026 adou. All rights reserved.
   * @license MIT
   * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
   */
  ```
- **学术与学习研究界定**：声明该系统主要用于学术及个人技术方案的研究论证，作者（adou）对使用者因自行运行、托管或分发该项目及代码而引起的任何直接或间接事件不承担法律连带责任。

---

# 🚀 高度自定义高颜值导航网站(含vps极速部署方式)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[![Cloudflare](https://img.shields.io/badge/Platform-Cloudflare-orange.svg)](https://www.cloudflare.com/)

[![Framework](https://img.shields.io/badge/Stack-VanillaJS%20%7C%20Serverless-success.svg)]()

这是一个具有超强自适应性、高辨识度视觉设计、支持实时自定义编辑的极致导航网站。本项目支持 **Cloudflare Pages +  KV + D1** 无服务器极速部署，同时也自带本地 Node.js 离线开发模拟服务，为您实现“线上线下、一键全通”的无缝体验。

- **本项目地址**：[cf-nav](https://github.com/alivedou/CF-nav/tree/v4)

- **本项目测试地址**：[项目测试地址](https://test--ikun-nav--25d5j47qxf4z.code.run)
- **vps极速部署视频**：[YouTube视频地址](https://test--ikun-nav--25d5j47qxf4z.code.run/?p=test)

- 测试项目由于使用的是没有挂载外部存储的容器部署的，在运营方重启后(运营方经常重启)，数据会丢失，因此:
- **测试项目仅用于操作示范和用户体验**。
- 目前我个人正在使用的版本是用cloudflare pages + kv +d1 使用wrangler部署的,目前已稳定运行超一周。

> [!TIP]
> 本项目是在 `880824` 同志的 `cloudflare-nav` [项目地址](https://github.com/880824/cloudflare-nav) 基础上开发的，针对日常使用痛点进行了深度优化。

---
## 📍 快速导航
* [🚀 飞往：VPS-Docker 极速部署](#️-部署方式一vps-docker-极速部署)
* [⚡ 飞往：手动部署至 Cloudflare Pages](#️-部署方式二手动部署至-cloudflare-pages白嫖cloudflare)
* [🔌 飞往：浏览器插件配合使用](#-浏览器插件配合使用推荐)

## 🏗️ 系统架构

```mermaid
graph TD
    User((用户)) --> CF_Pages[Cloudflare Pages]
    CF_Pages --> Functions[Pages Functions / API]
    Functions --> KV[(Workers KV: 配置/缓存)]
    Functions --> D1[(Cloudflare D1: 用户数据)]
    Local[本地开发环境] --> NodeServer[Node.js Express]
    NodeServer --> LocalKV[local_kv.json]
```

---

## ✨ 核心亮点与价值主张

本项目是一个专为高频上网人群、开发者、技术极客量身定制的**多用户高颜值导航系统**。基于 Cloudflare 全家桶（Pages + D1 + KV）实现 **100% 零成本、免服务器、免运维部署**，具备极致的视觉质感与超越普通书签管理器的企业级高级特性。

### 🎨 极致视觉与灵动交互

*   **Aero 磨砂玻璃美学**：拟物化超清毛玻璃（Glassmorphism）风格，支持自定义高分辨率背景（内置 Bing 每日壁纸自动获取）与卡片磨砂背景开关，给您丝滑的护眼享受。

*   **无级微调与个性布局**：卡片宽度实时无极微调、紧凑度（网格密度）自定义，甚至支持自定义链接跳转模式（当前页打开/新窗口打开），打造独一无二的专属仪表盘。

*   **全场景完美自适应**：深度适配手机、平板、带鱼屏等全尺寸设备。移动端定制行表单、搜索引擎 Tab 智能折行，将大屏的华丽与小屏的紧凑完美平衡。

### ⚡ 零门槛零成本云端部署

*   **100% 免费“白嫖”**：基于 Cloudflare Pages 静态托管、Cloudflare D1 边缘 SQLite 数据库与 Workers KV 存储，在完全不花一分钱的前提下获得**百万级并发承载力**。

*   **无数据库运维负担**：数据全球分布式缓存，毫秒级响应，享受极致的边缘计算（Edge Computing）首屏直开快感。

---

## 🛠️ 相比原版：重磅升级与新增功能

针对原版导航的功能痛点与性能瓶颈，我们进行了**脱胎换骨式的重构与高级功能升级**，彻底解决了数据不安全、图标加载慢、只能单人使用等局限性：

### 👥 1. 独创“企业级”多用户系统与权限控制

*   **多用户完全隔离**：支持多用户注册与独立登录，每个用户拥有完全隔离的分类、网址、布局和偏好设置，互不干扰，保护隐私。

*   **精细化角色与配额限制 (Quota)**：内置管理员 (`admin`)、普通用户 (`user`)、受邀用户等权限分发矩阵。针对不同角色分发精细配额（如：系统管理员 150 组分类、普通用户 12 组分类，单分类书签达 25~500 个不等），保护免费边缘服务器资源防止滥用。

*   **闭环邀请码系统**：支持生成邀请码注册机制，精准控制注册客群，一键开启/关闭公共注册。

*   **全局公告系统**：管理员可在后台发布全局公告，支持“强提醒”和“静默通知”模式，用户端自动维护“已读/未读”状态，保证信息精准触达。

### 🚀 2. 独家大文件 IndexedDB 引擎（告警/闪烁全消灭）

*   **突破 5MB 网页存储极限**：将原版不稳定的本地上传限制由 3MB 大幅放宽至 **10MB**。

*   **重构 IndexedDB 底层**：摒弃了易崩溃的 `localStorage`，重构为异步大容量的 `IndexedDB` 存储。首屏预加载极致优化，老缓存无缝向后兼容，实现开屏**零闪烁、零延迟**渲染。

### 🪄 3. 图标智能自愈与“智能魔棒”一键抓取

*   **6 级降级容灾逻辑**：自研高容错图标渲染引擎。在目标网站 CDN 挂掉、HTTPS 证书过期等极端情况下，通过 6 级自动降级机制（获取书签 Favicon、通用备用、首字母头像、底色圆圈等）确保页面永远不出现“破碎图标”。

*   **一键抓取魔棒**：在网址编辑框内，只需输入网址，点击“魔棒”按钮，后台将自动推荐最清晰的 CDN 图标或网络高清图片，免去四处找图标的烦恼。

### 🔍 4. 极致交互与效率工具

*   **万能搜索框与模糊检索**：搜索框内置 Google、Baidu、Bing 等主流搜索引擎，支持 Tab 快速自适应切，更支持**站内书签卡片实时快速模糊检索**，输入字母瞬间直达。
*   **极简禅意沉浸模式**：一键开启禅意空间，聚焦 Spotlight 焦点搜索框，支持全键盘友好响应，在沉浸中追求极致工作流。
*   **悬浮双向触达**：高辨识度悬浮返回顶部/快捷直达底部按钮，避免长列表滑动疲劳。

### 📡 5. 智能监控：异常即时告警与审计日报

*   **非阻塞异步告警**：系统发生异常时，CF Edge 异步分发堆栈，前端展示温和容错，管理员绑定的 **邮箱** 或 **Telegram 频道** 会在瞬间收到即时警报。

*   **安全审计日志**：自动记录敏感操作，并在每日通过邮件/Telegram 发送安全汇总日报。

**本项目地址**：[项目地址](https://github.com/alivedou/CF-nav/tree/v4)

---
## ☁️ 部署方式一：VPS-Docker 极速部署

具体原理详解在 [deployment-docker.md](docs/deployment-docker.md) 中有具体说明，本脚本只是将复杂的手动操作步骤封装成了菜单样式的交互式命令。

您可以选择以下两种极速安装方式中的任意一种：

### 🔹 方式1：在线一键运行（推荐）

境外 VPS 用户（GitHub 原生链接）

```bash
bash <(curl -sSfL https://raw.githubusercontent.com/alivedou/CF-nav/v4/ikun.sh)
```
---
### 🔹 方式2：分步本地下载运行（适合需要留存脚本的用户）
1.下载脚本（境外 VPS）

```bash
curl -sSfL https://raw.githubusercontent.com/alivedou/CF-nav/v4/ikun.sh -o ikun.sh
```

大陆境内 VPS 请直接创建一个`ikun.sh`，复制本项目中`ikun.sh`的内容执行吧。（我试了好几个镜像源都不行，只有这个土办法了）
- [`ikun.sh`跳转](https://github.com/alivedou/CF-nav/blob/v4/ikun.sh)

2.赋予脚本可执行权限

```bash
chmod +x ikun.sh
```

3.启动傻瓜菜单

```bash
./ikun.sh
```

## ☁️ 部署方式二：手动部署至 Cloudflare Pages（白嫖cloudflare）

部署本项目需要 `GitHub` 和 `Cloudflare` 账号。

| 平台 | 注册地址 | 登录地址 |
| :--- | :--- | :--- |
| **Cloudflare** | [注册](https://dash.cloudflare.com/sign-up) | [登录](https://dash.cloudflare.com/login) |
| **GitHub** | [注册](https://github.com/signup) | [登录](https://github.com/login) |

> [!IMPORTANT]
> **推荐顺序（按这个走，少踩坑）**  
> ① 建 KV + D1 → ② 初始化 D1 表结构 → ③ 创建 Pages 并设好构建参数 → ④ 绑定 KV/`DB`/环境变量 → ⑤ 重新部署  
> 旧文档里「先部署再初始化」也能用，但首屏 API 容易报 `no such table`；**先初始化再绑定更稳**。

### 第一步：创建 Cloudflare KV 空间与 D1 数据库
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. **创建 KV 空间**：
   * 菜单：**存储和数据库** -> **Workers KV**。
   * 点击 **“创建命名空间”**，命名为 **nav** (或其他自定义名称)。
3. **创建 D1 数据库**：
   * 菜单：**存储和数据库** -> **D1**。
   * 点击 **“创建数据库”**，选择 **“D1 数据库”**，数据库名称命名为 **cloudnav-db**，点击创建。

### 第二步：初始化 D1 数据库表结构（首次必做）
系统基于多用户 D1（SQLite）运作。**表结构不初始化，注册/登录/同步都会 500。**

#### 💡 方案 A：网页控制台（小白推荐）
1. 打开 **[sql/schema.console.sql](sql/schema.console.sql)**（专为控制台准备，少注释；也可用 [schema.sql](sql/schema.sql)）。
2. Cloudflare：**存储和数据库** → **D1** → **`cloudnav-db`** → **控制台 (Console)**。
3. 粘贴 SQL 后点 **执行**。若整段失败：按「一条 CREATE / 一条 INDEX」分次执行。
4. 成功后应能在「表」列表看到：`users`、`user_settings`、`categories`、`items`、`announcements`、`announcement_read_states`、`invitation_codes`、`audit_logs`。

> [!WARNING]
> **老库升级坑**：`CREATE TABLE IF NOT EXISTS` **不会**给已有表加新列。  
> 若你很早以前就建过库、后来代码加了字段，请再执行 **[schema.upgrade.sql](sql/schema.upgrade.sql)**（逐条执行即可；提示 `duplicate column` 表示该列已有，可忽略）。  
> 新版本边缘函数也会在首次请求时自动尝试补列，但**仍建议控制台跑一遍 upgrade 更稳**。

#### 💻 方案 B：Wrangler 命令行
```bash
npm install
npx wrangler login
# 需在 wrangler 配置中写好 cloudnav-db 的 database_id（见 wrangler.toml.example）
npx wrangler d1 migrations apply cloudnav-db --remote
```

### 第三步：部署 Cloudflare Pages 项目
1. 将本项目 **fork** 到您的 GitHub（分支使用 **`v4`**）。
2. Cloudflare：**Workers 和 Pages** → **创建** → **Pages** → **连接到 Git**。
3. **构建设置（非常重要，写错会 404 / 函数不生效）**：

| 项 | 必须填 |
| :--- | :--- |
| 生产分支 | **`v4`** |
| 框架预设 | **None** |
| **根目录 (Root directory)** | **`nav-main`** |
| 构建命令 | `npm install` |
| **构建输出目录** | **`public`**（相对根目录，即 `nav-main/public`） |

4. 点 **保存并部署**。若尚未绑定 KV/D1，函数可能报错，先做第四步再 **Redeploy**。

> **说明**：根目录必须是 `nav-main`，这样 `functions/` 与 `public/` 才会被 Pages 正确识别；`nav-main/wrangler.toml` 内已开启 `nodejs_compat`（鉴权依赖 jose）。

### 第四步：绑定 KV、D1 与环境变量（Production + Preview 都要加）
1. Pages 项目 → **设置** → **绑定 / 函数**（界面文案可能为 Bindings / Functions）。
2. **KV 命名空间绑定**：
   * 变量名：**`nav`**（小写，必须一致）
   * 命名空间：第一步创建的 KV
3. **D1 数据库绑定**：
   * 变量名：**`DB`**（大写，必须一致）
   * 数据库：`cloudnav-db`
4. **环境变量**（设置 → 变量）：
   - **必需**：`JWT_SECRET` = 一长串随机字符串（登录签名；不配会登录异常）
   - **可选**：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`、`CRON_SECRET`（日报/告警用）
5. 保存后务必做第五步重新部署，绑定才会进线上 Worker。

### 第五步：重新部署生效
1. **部署 (Deployments)** → 最近一次 → **重新部署 (Redeploy)**。
2. 打开站点，先 **注册第一个账号**（自动成为管理员）。
3. 若仍报错：浏览器 F12 → Network 看 `/api/*` 返回；常见原因见下表。

| 现象 | 原因 | 处理 |
| :--- | :--- | :--- |
| `no such table: users` | D1 未初始化或绑错库 | 重做第二步；检查绑定名是否为 `DB` |
| `no such column: xxx` | 老表缺列 | 执行 `sql/schema.upgrade.sql` 或等边缘补丁后再试 |
| 登录 500 / JWT 相关 | 未配 `JWT_SECRET` | 第四步补齐后 Redeploy |
| 静态页有、API 全挂 | 根目录不是 `nav-main` 或未绑 KV | 检查构建根目录与 `nav` 绑定 |
| 首期部署失败 | 未绑资源 | 正常；绑完 Redeploy |

---


## 💻 其他内容：本地开发与预览

### 1. 准备工作
需要先下载代码到本地。
```bash
npm install
```

### 2. 运行模式

| 模式 | 命令 | 说明 |
| :--- | :--- | :--- |
| **数据重置** | `npm run clean` | 【慎用】清空本地所有测试数据 (KV & D1) |
| **快速开发** | `npm run dev` | 使用 Node.js 运行，支持热重载，效率最高 |
| **环境预览** | `npm run preview` | 模拟真实的 Pages 运行环境 (Wrangler) |
| **数据库迁移** | `npm run db:migrate` | 初始化或更新本地 D1 数据库结构 |
| **代码规范** | `npm run format` / `lint` | 自动格式化代码及质量检查 |

> [!IMPORTANT]
> **环境数据隔离说明**:
> - **快速开发 (Node.js)**: 数据存储在根目录的 `local_d1.db` (数据库) 和 `local_kv/` (配置文件)。
> - **环境预览 (Wrangler)**: 数据存储在 `.wrangler/` 隐藏目录下，与 Node 环境完全隔离。
> - 如果您在 `npm run dev` 模式下删库，只需重启服务，系统会自动根据 `migrations/0000_init.sql` 进行自愈初始化。

### 3. 设置管理员密码（本地）
复制根目录下的 `.env.example` 并重命名为 `.env`，定义 `TOKEN` 变量。程序默认在 `http://localhost:3000` 启动，并读取 `kv_mock.json`。

---


## 📂 项目结构预览

```text
├── README.md / AGENTS.md   # 用户手册 / 维护约定
├── package.json / server.js / Dockerfile / ikun.sh
├── migrations/             # 运行时 DB 权威迁移（进 Docker）
├── sql/                    # 控制台/升级用 SQL（不进 Docker）
├── docs/                   # 长文档与测试报告
├── nav-main/               # CF Pages 根（public + functions）
│   ├── public/             # 静态前端
│   └── functions/api/      # Pages Functions
└── .env.example / wrangler.toml*
```

更细的目录说明见 [AGENTS.md](AGENTS.md)、[docs/README.md](docs/README.md)、[sql/README.md](sql/README.md)。

---

## ✉️ 系统异常告警与审计通知配置及测试指南

为了保障多用户导航系统的安全性和可观测性，系统内置了强大的**异常即时告警 (Exception Alerts)**与**每日审计日报定时分发 (Daily Audit Digest)**功能。可以通过以下指南配置和本地测试：

### 1. 本地 WSL 开发环境测试

由于本地环境通常不配备真实发信密钥，我们在 [server.js](server.js) 中内置了 **“WSL 控制台仿真打印”** 机制，可以零门槛完美闭环测试：

1. **绑定个人邮箱**：点击左下角高颜值的**用户卡片**打开“个人资料中心”，输入邮箱（如 `admin@example.com`）并确认保存。
2. **管理员授权通知**：进入**系统配置** -> **角色授权**菜单，搜索您的用户名。此时会展示您绑定的邮箱。勾选 `[x] 紧急告警` 与 `[x] 审计日报`，输入管理员密码进行二次核验并确认保存。
3. **模拟危险操作（生成审计日志）**：在管理后台随意修改一些站点配置、隐藏某个分类或删除网址项目。
4. **手动触发日报投递**：在浏览器直接访问本地端点：`http://localhost:3000/api/admin/cron-digest`。
5. **控制台见证奇迹**：回到 WSL 运行 `npm run dev` 的命令行终端，系统会将过去 24 小时内增量的全部审计日志编译，并以美观排版的 Markdown 格式**直接打印输出在 WSL 控制台终端上**。

### 2. 即时异常告警触发场景

全局未捕获异常已通过 [nav-main/functions/api/_middleware.js](nav-main/functions/api/_middleware.js) 网关无缝接管并分发：
- **触发场景**：边缘节点遇到严重的未捕获崩溃或运行时故障（如：D1 数据库连接异常、存储库爆满引发写入中断、Workers KV 连接超时或代码意外运行期崩溃）。
- **非阻塞告警**：崩溃发生时，网关会通过非阻塞线程将堆栈、出错文件、请求路径和客户端 IP 异步分发，网页端显示温和报错，管理员授权邮箱或 Telegram 频道瞬间收到告警。
- **本地测试**：可以在本地故意通过 `throw new Error("D1 物理连接异常丢失")` 抛出错误，或直接临时重命名 `local_d1.db`，请求报错接口即可在 WSL 终端看到紧急告警邮件的抛出打印。

### 3. 每日审计日报 Cron 调度与安全规则

- **安全校验机制（`CRON_SECRET` 的作用）**：
  为了防止陌生人恶意访问接口消耗发送配额，`/api/admin/cron-digest` 受到严格的安全密钥拦截。
  * **通关暗号**：外部定时程序（网上闹钟）调用该接口时，必须在 HTTP 请求头（Headers）中加入：
    ```text
    x-cron-secret: <您的 CRON_SECRET 变量值>
    ```
  * 如果没有这个请求头或值不匹配，接口会直接返回 `403 Forbidden`。

- **生产环境定时触发配置方式（免费 Web Cron 定时触发）**：
  由于 Cloudflare Pages 默认只接收 HTTP 请求（不自带自动定时唤醒路由的本地定时器），在生产部署下，请按照以下极简步骤，配置一个免费的“外部网上闹钟”来实现每日自动发送日报（1分钟搞定）：

  1. 注册并登录 [cron-job.org](https://cron-job.org/)（一个专门提供免费、稳定 Web Cron 的良心网站）。
  2. 在其控制台点击 **"Create Cronjob"**（创建定时任务）。
  3. **URL** 填写：`https://你的域名/api/admin/cron-digest`
  4. **Schedule**（执行计划）：选择每天北京时间早上 08:00 执行（或者自定义您喜欢的任何时间，时区选择 `Asia/Shanghai`）。
  5. **Request headers**（请求头设置,在advanced设置里面）：点击添加一行：
     * **Key**：`x-cron-secret`
     * **Value**：填写您在 Cloudflare Pages 后台设置的 **`CRON_SECRET`** 的真实值。
  6. 点击创建。每天到点，它就会自动带上您的专属钥匙叫醒系统，您的邮箱/TG 就能准时收到自检与审计日报了！

---

## 🔌 浏览器插件配合使用（推荐）

搭配浏览器插件体验更佳（以 Edge 为例）：

1. 在扩展商店搜索并安装 `custom new tab` (作者: `maltejur`)。
2. 安装后在扩展管理中启用。
3. 在插件设置里输入你的导航页网址（自定义域名）。
4. 点击 **Save** 并保存，开启对应按钮。

![部署示例](https://img.163898.xyz/api/rfile/guide1.png)

完成后，浏览器启动页和新建标签页都将自动打开你的私有导航站！🚀

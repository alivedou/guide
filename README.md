# 🚀 高度自定义高颜值导航网站 deployment & 指南

这是一个具有超强自适应性、高辨识度视觉设计、支持实时自定义编辑的极致导航网站。本项目支持 **Cloudflare Pages + Workers KV** 无服务器极速部署，同时也自带本地 Node.js 离线开发模拟服务，为您实现“线上线下、一键全通”的无缝体验。 
本项目是在`880824`同志的`cloudflare-nav`[项目地址](https://github.com/880824/cloudflare-nav) 基础上改的，在日常使用根据我的痛点，增加了以下功能：

1. 搜索搜索框可选内置三个搜索引擎可用于搜索本站内容和外部网站
2. 极简沉浸模式，只有你体会后才会觉得他的好。
3. 增加了返回顶部和底部按钮功能，避免后续添加网站过多，滑动太费劲。
4. 可设置搜索框位置在顶部或者第一栏（常用网站栏）下方。
5. 可设置选择跳转方式（从本页直接跳转，或者新开一页跳转）。
6. 全效图标自愈系统 v2：实现了更稳健的 5 级降级逻辑。加载失败时自动尝试：站点原生 favicon.ico -> Iowen API -> QQSuu API -> Google API -> DuckDuckGo API -> 域名首字母矢量占位图。
7. 图标魔棒工具：修复了添加无图标网站时费力对比的痛点，编辑器内一键抓取并自动选择最优可用图标。
8. 交互逻辑优化：侧边栏在移动端/平板点击操作后自动收起，防止遮挡弹窗；本地搜索支持键盘方向键与 Enter 快捷导航；偏好设置增加网格尺寸预设按钮。

**项目地址** [注意是dev分支](https://github.com/alivedou/nav/tree/dev)

---
## 🎨 核心亮点与能力

*   **极简主义视觉设计**：支持卡片宽度实时无极微调、两种视觉主线风格（经典毛玻璃/高颜值缤纷模式）、毛玻璃/卡片背景开关以及自定义高分辨率背景（内置必应每日壁纸缓存自适应获取）。
*   **极致自适应适配**：针对手机端、Pad、超宽显示器深度自适应适配，包括移动端独立行表单、搜索引擎 Tab 自适应折行，以及更小的卡片圆角和紧凑间距，极致触觉体验。
*   **无需数据库的持久化**：生产环境对接 Cloudflare Workers KV 空间，本地开发模式采用精简本地 JSON 模拟 KV 写入，逻辑无缝匹配。

---

## ☁️ 部署至 Cloudflare Pages 详细步骤

部署本项目需要两个免费的账号：`github`账号和`Cloudflare`账号。
| 平台 | 注册地址 | 登录地址 |
| :--- | :--- | :--- |
| **Cloudflare** | [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) | [https://dash.cloudflare.com/login](https://dash.cloudflare.com/login) |
| **GitHub** | [https://github.com/signup](https://github.com/signup) | [https://github.com/login](https://github.com/login) |

注册好后，需要先**fork**到你自己的仓库（`推荐项`），或者选择项目zip包上传到你的仓库。
**项目地址** [项目地址](https://github.com/alivedou/nav/tree/dev)
然后就是在Cloudflare 进行部署操作。 [https://dash.cloudflare.com/login](https://dash.cloudflare.com/login) 

请按照以下步骤，三分钟完成部署：

### 第一步：创建 Cloudflare Workers KV 空间
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 在左侧菜单栏中依次点击 **存储和数据库** -> **Workers KV** 。
3. 点击右上角的 **“创建命名空间” (Create a Namespace)**。
4. 将命名空间命名为 **`nav`**或者其他你好记的名字，并点击保存。

### 第二步：部署 Cloudflare Pages 项目

#### 使用 GitHub 自动部署
1. 需要将本项目的所有文件fork到您的私有或公开 GitHub 仓库。
2. 在 Cloudflare 控制台左侧点击 **Workers 和 Pages** -> **创建项目 (Create Application)** -> 切换到 **Pages (页面)** 标签页。
3. 点击 **“连接到 Git” (Connect to Git)** 并授权指定您的导航项目仓库。
4. 进入构建设置 (Build settings)，进行如下填写（**非常重要，需完美定位目录**）：
   *   **项目名称**：小白默认填`nav`或者其他你好记忆的名字。
   *   **生产分支**：*PS*：必须选择 **dev** ，错选成`main`的话是原版，不带我增添的搜索引擎和其他功能。
   *   **框架预设 (Framework preset)**：选择 `None`或者说空着不填。
   *   **构建命令 (Build command)**：**留空 (不填)** 即可。
   *   **构建输出目录 (Build output directory)**：填入 **`public`**（*即指向 `nav-main/public` 的输出静态资源*）。
   *   **根目录(高级) (Root directory)**：填入 **`nav-main`** （*因为静态主程序和 Pages Functions 函数文件都存放于该目录下*）。
5. 点击 **“保存并部署” (Save and Deploy)**。

---

### 第三步：在 Cloudflare 中绑定 KV 和设置管理员密码
部署完成后，还需要将创建的 KV 存储与管理员环境变量绑定分配给 Pages 项目：

1. 进入你刚刚创建的 Pages 项目页面，点击顶部的 **“设置” (Settings)**。
2. 在左边栏中点击 **“函数” (Functions)**。
3. 往下滚动到 **“KV 命名空间绑定” (KV namespace bindings)**。
4. 点击 **“添加绑定” (Add binding)**，有两处环境需要添加（**开发 Production** 与 **预览 Preview**）：
   *   **变量名称 (Variable name)** 必须填写：**`nav`**
   *   **KV 命名空间 (KV namespace)** 选择：第一步中创建的默认的**`nav`**或者你自己创建的自定义kv空间名字。
5. 紧随其后配置管理员主密码：
   *   在 **设置 (Settings)** -> **环境变量 (Environment Variables)** 下。
   *   点击 **“添加变量” (Add variable)**。
   *   **变量名 (Variable name)** 填入：**`TOKEN`**
   *   **值 (Value)** 填入：输入你想设置的管理员密码（支持**明文密码**，如 `123456`，或者该密码对应的 **SHA-256 哈希值**。若留空，则只需空着点回车即可免费进入自定义模式）。
6. **重要**：如果您更新了设置，请到 **“部署” (Deployments)** 页面下，点击所有部署下面最近的一个部署，
点他右边的`...` 后， 再点击 **"重新部署" (Redeploy)**，以便让这些全局变量和 KV 绑定在云服务进程中生效！

---

## 💻 本地运行与离线模拟运行

如果您希望在本地调试、无外网极速演练、或者直接把它当成个人离线单机版导航，我们也为您提供了运行模拟器。（前提是装了nodejs）

1. **安装基本依赖项目**：
   在项目根目录下通过终端（Terminal / CMD）执行：
   ```bash
   npm install
   ```

2. **设置本地配置环境变量（可选）**：
   复制项目根底下的 `.env.example` 并重命名为 `.env`，可在这里自由定义 `TOKEN` 密码值（默认密码空着回车即可）。

3. **极速启动**：
   ```bash
   npm start
   ```
   程序将默认在本地的 **`http://localhost:3000`** 端口上启动，并生成并读取本地 `kv_mock.json` 配置文件。您可以完美实现本地个性化配置、导入导出、测试及更新。

---

## 📂 项目结构预览

```text
├── README.md               # 您当前阅读的项目部署手册
├── .env.example            # 环境变量配置样本
├── server.js               # 本地极其强大的 Web/Express API KV 模拟持久化后端
├── kv_mock.json            # 本地离线环境保存的 JSON 数据仓库（启动后自动产生）
└── nav-main/               # 部署云端的主体核心子目录
    ├── functions/          # Cloudflare Pages Serverless 核心逻辑
    │   └── api/
    │       ├── config.js   # 动态鉴权、防泄露、精简化过滤、自动必应壁纸注入逻辑板
    │       └── defaultData.js # 默认初始网站和设置库
    └── public/             # 纯前端高颜值界面资产
        ├── assets/
        │   ├── css/style.css # 高定制、支持触屏与流体弹性排版的样式引擎
        │   └── js/app.js     # 负责流畅拖拽排序、设置无级调整、哈希登录的主业务逻辑
        └── index.html      # 精致的静态主页面
```

**PS：**
1. 有条件的小伙伴还可以选择添加自定义域名，相关教程请自行浏览器搜索或询问AI以下内容：
``bash
怎么给cloudflare 部署的 pages 添加自定义域名？
``
2. 搭配浏览器使用 启动、主页和新建选项卡页 ，设置为启动时`打开自定义网站`，
在里面输入你的自定义导航网站，使用体验更佳。

快去享受属于你自己的云端无服务器高度自定义导航站吧！🚀

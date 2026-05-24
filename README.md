# 🚀 高度自定义高颜值导航网站 deployment & 指南

这是一个具有超强自适应性、高辨识度视觉设计、支持实时自定义编辑的极致导航网站。本项目支持 **Cloudflare Pages + Workers KV** 无服务器极速部署，同时也自带本地 Node.js 离线开发模拟服务，为您实现“线上线下、一键全通”的无缝体验。

---

## 🎨 核心亮点与能力

*   **极简主义视觉设计**：支持卡片宽度实时无极微调、两种视觉主线风格（经典毛玻璃/高颜值缤纷模式）、毛玻璃/卡片背景开关以及自定义高分辨率背景（内置必应每日壁纸缓存自适应获取）。
*   **极致自适应适配**：针对手机端、Pad、超宽显示器深度自适应适配，包括移动端独立行表单、搜索引擎 Tab 自适应折行，以及更小的卡片圆角和紧凑间距，极致触觉体验。
*   **无需数据库的持久化**：生产环境对接 Cloudflare Workers KV 空间，本地开发模式采用精简本地 JSON 模拟 KV 写入，逻辑无缝匹配。

---

## ☁️ 部署至 Cloudflare Pages 详细步骤

Cloudflare Pages 免费额度充足，是极速上线个人导航页面的不二选择。请按照以下步骤，三分钟完成部署：

### 第一步：创建 Cloudflare Workers KV 空间
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 在左侧菜单栏中点击 **Workers 和 Pages (Workers & Pages)** -> **KV** (或者选择进入旧版的 KV 部分)。
3. 点击右上角的 **“创建命名空间” (Create a Namespace)**。
4. 将命名空间命名为 **`nav`**（注：*核心逻辑强制匹配 `nav`，请确保命名一致*），并点击保存。

### 第二步：部署 Cloudflare Pages 项目
你可以通过 **连接 GitHub 仓库自动部署**（推荐，后续有更新只需要 push 即可自动打包）或 **直接手动上传文件夹**。

#### 选项 A：使用 GitHub 自动部署（强烈推荐 👍）
1. 将本项目的所有文件推送到您的私有或公开 GitHub 仓库。
2. 在 Cloudflare 控制台左侧点击 **Workers 和 Pages** -> **创建项目 (Create Application)** -> 切换到 **Pages (页面)** 标签页。
3. 点击 **“连接到 Git” (Connect to Git)** 并授权指定您的导航项目仓库。
4. 进入构建设置 (Build settings)，进行如下填写（**非常重要，需完美定位目录**）：
   *   **框架预设 (Framework preset)**：选择 `None`。
   *   **项目根目录 (Root directory)**：填入 **`nav-main`** （*因为静态主程序和 Pages Functions 函数文件都存放于该目录下*）。
   *   **构建命令 (Build command)**：**留空 (不填)** 即可。
   *   **构建输出目录 (Build output directory)**：填入 **`public`**（*即指向 `nav-main/public` 的输出静态资源*）。
5. 点击 **“保存并部署” (Save and Deploy)**。

#### 选项 B：手动拖拽/打包上传
1. 在 Cloudflare Pages 项目创建中，点击 **“直接上传” (Upload assets)**。
2. 将 `nav-main` 文件夹直接打包或直接拖拽进网页。
3. 请记住，上传的目录本身应该直接呈现静态网页和 `functions` 文件夹作为平级节点，请确认上传的内容解包后能与你的目录结构匹配良好。

---

### 第三步：在 Cloudflare 中绑定 KV 和设置管理员密码
部署完成后，还需要将创建的 KV 存储与管理员环境变量绑定分配给 Pages 项目：

1. 进入你刚刚创建的 Pages 项目页面，点击顶部的 **“设置” (Settings)**。
2. 在左边栏中点击 **“函数” (Functions)**。
3. 往下滚动到 **“KV 命名空间绑定” (KV namespace bindings)**。
4. 点击 **“添加绑定” (Add binding)**，有两处环境需要添加（**开发 Production** 与 **预览 Preview**）：
   *   **变量名称 (Variable name)** 必须填写：**`nav`**
   *   **KV 命名空间 (KV namespace)** 选择：第一步中创建的 **`nav`**
5. 紧随其后配置管理员主密码：
   *   在 **设置 (Settings)** -> **环境变量 (Environment Variables)** 下。
   *   点击 **“添加变量” (Add variable)**。
   *   **变量名 (Variable name)** 填入：**`TOKEN`**
   *   **值 (Value)** 填入：输入你想设置的管理员密码（支持**明文密码**，如 `123456`，或者该密码对应的 **SHA-256 哈希值**。若留空，则只需空着点回车即可免费进入自定义模式）。
6. **重要**：如果您更新了设置，请到 **“部署” (Deployments)** 页面下，点击最近部署的 **“重新部署” (Redeploy)**，以便让这些全局变量和 KV 绑定在云服务进程中生效！

---

## 💻 本地运行与离线模拟运行

如果您希望在本地调试、无外网极速演练、或者直接把它当成个人离线单机版导航，我们也为您提供了运行模拟器。

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

快去享受属于你自己的云端无服务器高度自定义导航站吧！🚀

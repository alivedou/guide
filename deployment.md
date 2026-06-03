@fileoverview 
@author adou
@copyright Copyright (c) 2026 adou. All rights reserved.
@license MIT
@disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
# 🚀 从零开始：Cloudflare 全新部署上云 6 步法

## 第一步：登录 Wrangler CLI 工具

在您的 wsl 终端中安装并进行 Cloudflare 账户授权登录：

```bash
npm install -g wrangler
wrangler login
```

## 第二步：创建 D1 数据库（并配置）

1.创建 D1 实例：

```bash
wrangler d1 create cloudnav-db
```

2.记录并修改 ID：
创建成功后，控制台会输出一串 16 进制字符的 database_id。
请打开项目根目录下的 wrangler.toml，将 wrangler.toml:13 中的 database_id = "YOUR_D1_DATABASE_ID" 修改为您刚获取到的 真实 D1 ID。

## 第三步：创建 KV 命名空间（并配置）

1.创建 KV 实例：

```bash
wrangler kv namespace create nav
```

2.记录并修改 ID：
创建成功后，控制台会输出一串 id。
打开 wrangler.toml，将 wrangler.toml:9 中的 id = "YOUR_KV_NAMESPACE_ID" 修改为您刚获取到的 真实 KV ID。

## 第四步：推送 D1 数据库初始化结构

在根目录下执行该命令，Wrangler 会自动扫描 migrations 目录下的所有本地 SQL 数据表结构并灌入到您刚创建的远程 D1 数据库中：

```bash
wrangler d1 migrations apply cloudnav-db --remote
```

(中途如有提示，输入 y 确认并继续执行。)

## 第五步：进入核心目录并执行一键部署

1.必须要先进入 nav-main 子系统文件夹中：

```bash
cd nav-main
```

2.执行发布命令（带上英文 commit 信息绕过工具 Bug）：

```bash
wrangler pages deploy ./public --project-name=cloudnav --commit-message="Fresh CloudNav Deploy"
```

(在首次部署过程中，控制台询问是否创建新项目时，直接按下 Enter 确认，分支提问时直接回车或输入 main 即可。)
第六步：到 Cloudflare 网页端完成最后的关联绑定

- 1.登录 Cloudflare 官方控制台
- 2.依次进入：Workers & Pages → cloudnav (刚创建的 Pages 项目) → Settings → Functions ；
- 3.KV 命名空间绑定 (KV Namespace Bindings)：
点击新增绑定，Binding name 填入 nav，并选中您刚创建的 KV 实例。
- 4.D1 数据库绑定 (D1 Database Bindings)：
点击新增绑定，Binding name 填入 DB，并选中您刚创建的 D1 数据库。
- 5.添加加密密钥环境变量：
在 Environment variables 中点击 Add variables，新增环境变量：
JWT_SECRET →  （示例：英文和数字字符，可以使用任意复杂密钥）

### 必需项

`JWT_SECRET` ：一长串安全随机字符串，建议用UUID随机生成 (用于 JWT Token 的加解密签名)。

### 可选项：（用于多人使用时管理网站用）

`TELEGRAM_BOT_TOKEN`：用于日常管理异常通知 (可选项：用于管理员定时日报和异常项目的通知)。
`TELEGRAM_CHAT_ID`：填群ID（可选项：若要向多用户私信群发，系统会自动联表读取各用户个人资料自己绑定的 TG_ID；这里的 CHAT_ID 仅用于系统对公共频道或管理大群的广播）。
`CRON_SECRET`：一长串安全随机字符串，建议用UUID随机生成 (可选项：用于管理员定时日报的安全拦截，日报则是记录网站管理员高危操作的通知)。

- 6.激活重新发布：
配置完毕后，在 wsl 终端中再次运行一次

 ```bash
 wrangler pages deploy ./public --project-name=cloudnav --commit-message="Activate Config"
 ```

 ，即可完美通关，全站极速上线运行！
 **PS:**  

- 1.1 ： 如需要使用日报功能，请完成 `readme.md` 中 `系统异常告警与审计通知配置及测试指南下` 的第3个步骤操作。

- 1.2 ：搭配浏览器插件体验更佳（以 Edge 为例）：

1. 在扩展商店搜索并安装 `custom new tab` (作者: `maltejur`)。
2. 在插件设置里输入你的导航页网址（自定义域名）。
3. 点击 **Save** 并保存，开启对应按钮。

---

## 🐋 备用方案：Docker 容器化部署指南

如果您未来选择脱离 Cloudflare 托管，可以使用我们配置好的 Docker 生产就绪方案进行自建部署：

### 第一步：自动打包生成镜像（通过 GitHub Actions）
1. 确保您的代码已推送到 GitHub 仓库。
2. 只要您向 `main` 分支推送（Push）代码，内置的 GitHub Actions 就会自动构建 Node.js 22 LTS 镜像并免费发布到您的 **GHCR** 仓库（镜像名格式：`ghcr.io/您的用户名/您的仓库名:latest`）。

### 第二步：运行与环境变量配置

#### 💡 方法 A：在自建 VPS 上直接运行（使用命令行参数配置）
直接通过 `-e` 选项在运行时注入您的环境变量，并挂载本地数据目录以实现永久存储：

```bash
docker run -d \
  -p 3000:3000 \
  -e JWT_SECRET="您的安全随机密钥" \
  -e TELEGRAM_BOT_TOKEN="您的TG机器人Token（可选）" \
  -e TELEGRAM_CHAT_ID="您的TG群ID（可选）" \
  -v $(pwd)/local_kv:/app/local_kv \
  -v $(pwd)/local_d1.db:/app/local_d1.db \
  --restart always \
  --name cloudnav-app \
  ghcr.io/您的用户名/您的仓库名:latest
```

> **📌 端口映射提示 `-p <宿主机端口>:<容器内部端口>`：**
> * 默认情况下将内网端口 `3000` 映射到宿主机端口 `3000`，通过 `http://您的IP:3000` 访问。
> * **若想通过网页标准 80 端口（免除端口后缀）直接访问**：请将命令中的 `-p 3000:3000 \` 修改为 **`-p 80:3000 \`**。
> * **若想通过 SSL 443 端口提供直接访问**：可修改为 **`-p 443:3000 \`**。


#### 💡 方法 B：在 Railway 等 PaaS 云平台上部署（免运维首选）
1. 登录 Railway 控制台，关联您在 GitHub 的本项目仓库。
2. 在新建的服务（Service）设置中，找到 **Variables** 选项卡。
3. 直接在页面中以键值对的形式填入环境变量（如 `JWT_SECRET`、`TELEGRAM_BOT_TOKEN` 等）。
4. **添加持久化磁盘（Volume）**：在服务设置中新增 Volume 并挂载到 `/app`，以确保本地 SQLite 数据库及缓存文件在容器更新时永久保留。
5. 保存后 Railway 会自动启动，通关运行！


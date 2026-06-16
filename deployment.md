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
2. 需要GitHub Actions 手动构建 Node.js 22 LTS 镜像并免费发布到您的 **GHCR** 仓库（镜像名格式：`ghcr.io/您的用户名/您的仓库名:latest`）。

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


**补一个内容**

# 原生 Nginx 域名绑定与 HTTPS 自动化配置指南

本指南适用于在 VPS 上已经安装原生 Nginx（如 nginx/1.24.0）的环境下，将“IP+端口”（如 `http://IP:3000`）的网站完美转换为“域名+HTTPS”（如 `https://nav.yourdomain.com`）的标准工业级操作流程。

---

## 🛠️ 第一步：环境准备与 Certbot 证书工具安装

Certbot 是自动化申请和续期 Let's Encrypt 免费 SSL 证书的神器，它能自动识别 Nginx 配置并完成 HTTPS 升级。

在 VPS 终端依次运行以下命令：
```bash
# 1. 更新系统软件包源
sudo apt update

# 2. 安装 snapd 包管理器
sudo apt install snapd -y

# 3. 通过 snap 安装最新版 certbot
sudo snap install --classic certbot

# 4. 创建软链接，确保全局可直接调用 certbot 命令
sudo ln -s /snap/bin/certbot /usr/bin/certbot
📝 第二步：编写 Nginx 反向代理配置文件
无需修改 Nginx 全局臃肿的 nginx.conf，为其单独建立一个干净的虚拟主机配置文件。

1. 创建并打开配置文件
Bash
# 创建一个名为 ikun-nav 的独立配置文件
nano /etc/nginx/sites-available/ikun-nav
2. 写入反向代理标准配置
将以下内容原封不动粘贴进编辑器，务必注意大括号 {} 的完全闭合：

Nginx
server {
    listen 80;
    server_name nav.yourdomain.com; # 🚨 填写您解析好的真实域名

    location / {
        # 核心：将访问域名的流量，秘密转发给本地 Docker 容器的 3000 端口
        proxy_pass http://127.0.0.1:3000; 
        
        # 传递真实的客户端真实 IP 和 Host 头，防止后端程序获取到错误的访问源
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 完美支持 WebSocket 通信（保证网站后台定时审计/日志流等长连接顺畅）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
提示：在 nano 编辑器中，按 Ctrl + O 然后回车保存，按 Ctrl + X 退出。

3. 激活配置文件并重载 Nginx
Bash
# 1. 创建软链接，将可用配置（sites-available）激活到已启用配置（sites-enabled）
ln -s /etc/nginx/sites-available/ikun-nav /etc/nginx/sites-enabled/

# 2. 核心语法检查（绝对不能省略！预防括号缺失导致全站瘫痪）
nginx -t
💡 预期输出：
nginx: configuration file /etc/nginx/nginx.conf test is successful
如果看到 successful，即可安全重启 Nginx：

Bash
# 3. 重启 Nginx 服务使配置生效
systemctl restart nginx
🔒 第三步：全自动一键申请 SSL 证书并升级 HTTPS
让 Certbot 登场，它会自动读取上一步写的 Nginx 配置文件，现场向权威机构申请证书，自动改写 Nginx 逻辑实现 HTTP 强制跳转 HTTPS。

Bash
# 运行一键证书配置命令
sudo certbot --nginx -d nav.yourdomain.com
⌨️ 交互式命令选项说明：
Enter email address：输入您的真实常用邮箱（用于证书发生未预期续期失败时接收官方警告邮件通知）。

Terms of Service：输入 Y（接受服务条款）并回车。

Share your email：输入 N（拒绝接受官方发起的其他资讯推广邮件）并回车。

Configure Redirect (如有提示)：如果问你是否将所有 HTTP 流量强制重定向到 HTTPS，选择 2 (Redirect) 并回车。

🏆 第四步：通关验证与底层安全加固
当终端打印出 Congratulations! You have successfully enabled ...，代表大功告成！

1. 验收
直接在浏览器输入：https://nav.yourdomain.com，网站将以无端口的形式，带着绿色安全锁（HTTPS）完美打开。

2. 终极安全加固（强烈推荐）
既然反向代理和域名已全部调通，外界访问流量都由 Nginx（80/443端口）接管。为了防止黑客绕过域名直接通过 IP 攻击您的底层 3000 端口，请前往您的 VPS 云厂商后台（阿里云/腾讯云/各路云的安全组或防火墙规则）中，彻底关闭 3000 端口的入站权限。

3. 证书续期无忧
Certbot 在安装时已自动在 Linux 系统中埋下了 systemd 定时任务。每隔 90 天证书即将到期前，它会自动在后台悄悄完成续期，无需人工介入，真正一劳永逸。


@fileoverview 
@author adou
@copyright Copyright (c) 2026 adou. All rights reserved.
@license MIT
@disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。

# 📋 导航站：VPS 生产环境标准部署指南

## ps：需要先手动去到github actions手动生成一个docker镜像

## 📂 第一步：准备宿主机工作目录

在 VPS 上创建用于存放项目配置和持久化数据的统一目录。

### 创建项目根目录

```bash
mkdir -p /opt/my-nav/local_kv_data
```

### 进入项目根目录

```bash
cd /opt/my-nav
```

## 🔑 第二步：配置环境变量（建立 .env）

在 /opt/my-nav 目录下创建 .env 文件，用于存放系统运行所需的敏感密钥和配置。

```Bash
nano .env
```

在打开的编辑器中，写入你的生产环境配置（根据实际情况修改右侧的值）：

```Bash
#代码段
PORT=3000
NODE_ENV=production
# 你的 JWT 加密密钥（自行输入一段随机长字符串）
JWT_SECRET=your_super_secret_jwt_key_here
# 如果有管理员初始密码、第三方 API 密钥或 TG 机器人配置，一并写在这里
# TELEGRAM_BOT_TOKEN=xxxxxx
# TELEGRAM_CHAT_ID=xxxxxx
```

提示：在 nano 编辑器中，按 Ctrl + O 然后回车保存，按 Ctrl + X 退出。

## 🗄️ 第三步：初始化持久化数据库目录权限

由于 SQLite 数据库是以文件形式直接存储在宿主机的 /opt/my-nav/local_kv_data 目录中，为了防止容器内程序因“没有写入权限（Permission Denied）”而闪退，需要放开该目录的写入权限：

```Bash
chmod -R 777 /opt/my-nav/local_kv_data
```

## 🚀 第四步：拉取镜像与生产环境运行

执行标准的 Docker 命令，拉取 GitHub Packages 上的最新镜像，并挂载目录、引入环境变量运行容器。

1. 拉取最新的 GitHub 镜像

```Bash
docker pull ghcr.io/2bdou/ikun_nav:sha-de7b278
```

2. 一键启动容器

```Bash
docker run -d \
  --name ikun-navigation \
  -p 3000:3000 \
  --env-file .env \
  -v /opt/my-nav/local_kv_data:/app/local_kv \
  --restart always \
  ghcr.io/2bdou/ikun_nav:xxxxx（换成你生成的镜像）
```

💡 核心参数大白话解释：

```bash
-d: 后台运行容器。

--name ikun-navigation: 给容器起个名字叫 ikun-navigation。

-p 3000:3000: 把 VPS 的 3000 端口映射到容器内的 3000 端口。

--env-file .env: 自动读取我们刚才在本地建立的 .env 环境变量文件。

-v /opt/my-nav/local_kv_data:/app/local_kv: 【最关键的持久化】 把 VPS 本地的目录挂载到容器内的数据库目录。这样哪怕容器删了重构，你的网站数据、导航网址也绝对不会丢。

--restart always: 开机自启，且程序如果意外崩溃会自动重启。
```

## 🏁 第五步：验证运行状态

```Bash
docker ps
```

检查输出结果中的 STATUS 列，只要显示 Up ... 并且端口显示 0.0.0.0:3000->3000/tcp，即代表全套部署完美成功！

- 后续直接访问 http://你的VPS公网IP:3000 即可。

## 如果后续忘记密码或者想要删除请执行

### 1. 彻底停掉并删掉容器

```bash
docker rm -f ikun-navigation
```
### 2. 连文件夹带里面的所有未知文件一竿子全部打死

```bash
rm -rf /opt/my-nav/local_kv_data
```

### 3. 重新创建干净的文件夹

```bash
mkdir -p /opt/my-nav/local_kv_data
chmod -R 777 /opt/my-nav/local_kv_data
```

**还要重新建.env作为环境变量**(请参照上面的第二步内容)

### 4. 重新跑起你的 docker run 连招
```bash
docker run -d \
  --name ikun-navigation \
  -p 3000:3000 \
  --env-file .env \
  -v /opt/my-nav/local_kv_data:/app/local_kv \
  --restart always \
  ghcr.io/2bdou/ikun_nav:sha-de7b278
```

#### 💡 部署方法 B：在 Railway 等 PaaS 云平台上部署（免运维首选）

1. 登录 Railway 控制台，关联您在 GitHub 的本项目仓库。
2. 在新建的服务（Service）设置中，找到 **Variables** 选项卡。
3. 直接在页面中以键值对的形式填入环境变量（如 `JWT_SECRET`、`TELEGRAM_BOT_TOKEN` 等）。
4. **添加持久化磁盘（Volume）**：在服务设置中新增 Volume 并挂载到 `/app/local_kv`，以确保本地 SQLite 数据库及缓存文件在容器更新时永久保留。
5. 保存后 Railway 会自动启动，通关运行！

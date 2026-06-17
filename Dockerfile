# 使用主流且与您本地完全一致的 Node.js 22 LTS 作为基础镜像
FROM node:22-slim AS builder

# 安装 better-sqlite3 编译所需的依赖
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖描述文件
COPY package*.json ./

# 仅安装生产环境依赖并自动编译 native 插件 (结合主流的 Docker Build Cache 挂载及 --omit=dev 标准参数)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# 运行阶段：采用干净的精简镜像，保持容器极度轻量化
FROM node:22-slim

WORKDIR /app

# 从构建阶段复制已编译好的 node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# 复制项目核心文件
COPY server.js ./
COPY migrations/ ./migrations/
COPY nav-main/ ./nav-main/

# 创建持久化挂载目录
RUN mkdir -p local_kv

# 声明持久化数据卷，提示并指引用户挂载该目录以防重建容器导致数据丢失
VOLUME ["/app/local_kv"]

# 声明端口与环境变量
ENV PORT=3000
ENV NODE_ENV=production
# 💡 适配项目绝对核心：配置 SQLite 的持久化路径至挂载的 local_kv 目录，解决容器重启/重建时数据库丢失的重大隐患
ENV DB_PATH=/app/local_kv/local_d1.db
# ⚠️ 以下为可选环境变量，个人使用可保留注释状态
# ENV JWT_SECRET=your_jwt_secret_here
# ENV CRON_SECRET=your_cron_secret_here
# ENV TELEGRAM_BOT_TOKEN=your_tgbot_token
# ENV TELEGRAM_CHAT_ID=your_group_chat_id
EXPOSE 3000

# 启动服务器
CMD ["node", "server.js"]

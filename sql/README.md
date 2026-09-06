# SQL 材料目录

本目录存放**给人用**的 SQL 文件，**不参与 Docker 镜像构建**。

| 文件 | 用途 |
|------|------|
| `schema.sql` | 完整结构说明 + 可执行 CREATE（与 `migrations/0000_init.sql` 表结构应对齐） |
| `schema.console.sql` | Cloudflare D1 控制台粘贴初始化 |
| `schema.upgrade.sql` | 已有老库补列/补表（duplicate column 可忽略） |

## 和 `migrations/` 的关系

| 路径 | 谁用 | 是否进 Docker |
|------|------|----------------|
| `migrations/0000_init.sql` | **权威源**；`server.js` 自愈、`wrangler d1 migrations apply` | **是**（Dockerfile `COPY migrations/`） |
| `sql/*` | 文档、CF 控制台、手工升级 | **否** |

改表结构流程：

1. 只改 **`migrations/0000_init.sql`**（及必要时新迁移文件）
2. 同步更新 **`sql/schema.sql`** 的表结构正文
3. 按需更新 `schema.console.sql` / `schema.upgrade.sql`
4. 重新 build 镜像时，容器只会带上 `migrations/`，行为与是否存在 `sql/` 无关

## Cloudflare

见仓库根目录 `README.md` 部署方式二。

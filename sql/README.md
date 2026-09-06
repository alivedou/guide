# SQL 材料目录

本目录存放**给人用**的 SQL，由权威源生成，**不参与 Docker 镜像构建**。

```bash
npm run sql:generate    # 从 migrations/0000_init.sql + PATCH_SQL 重写本目录
npm run sql:check       # CI 门禁（tests/phase6）
```

不要手改 `schema.sql` / `schema.console.sql` / `schema.upgrade.sql`。改表只动：

1. **`migrations/0000_init.sql`**（完整 CREATE，运行时权威）
2. **`nav-main/shared/schema-patch.js` 的 `PATCH_SQL`**（老库缺列/缺表）
3. 再跑 `npm run sql:generate`

| 文件 | 用途 |
|------|------|
| `schema.sql` | 完整 CREATE（与 `0000_init.sql` 表/列集合相等） |
| `schema.console.sql` | Cloudflare D1 控制台粘贴初始化 |
| `schema.upgrade.sql` | 与 `PATCH_SQL` 同一组语句（duplicate column 可忽略） |

| 路径 | 谁用 | 是否进 Docker |
|------|------|----------------|
| `migrations/0000_init.sql` | **权威源**；server 自愈、`wrangler d1 migrations apply` | **是** |
| `sql/*` | 文档、CF 控制台、手工升级 | **否** |

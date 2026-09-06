# CF-nav v4 重构方案

这是一份给 [alivedou/CF-nav](https://github.com/alivedou/CF-nav) **v4 分支**用的结构诊断和分阶段重构说明书。

导航站本体不在这里。这里不重写 CloudNav，也不把它换成 Next.js。阅读对象是：已经在跑的多用户导航（Cloudflare Pages + KV + D1，以及 Docker + SQLite），目录感觉乱、又不能丢功能。

## 结论（先看这个）

乱，主要不是「文件夹名字不好」，而是：

1. **同一套 API 写了两遍**（根目录 `server.js` 和 `nav-main/functions`）。
2. **几个上帝文件**：`app.js` 4388 行、`style.css` 5739 行、`server.js` 1968 行。
3. **表结构维护了四份 SQL，外加两份运行时热补丁。**

对策是抽出 `nav-main/shared`（Pages 构建根必须能看见共享代码），再按功能拆文件。双部署、无打包前端、绑定名、`ikun.sh` 路径都保持不动。

完整施工单见 [docs/REFACTORING.md](./docs/REFACTORING.md)。  
测试目录、分阶段用例和验收标准见 [docs/TESTING.md](./docs/TESTING.md)。

## 本地预览本说明书

```bash
npm install
npm run dev
```

浏览器打开终端里提示的地址（默认 `http://127.0.0.1:43147`）。

```bash
npm run build
npm start
```

## 和 CF-nav 的关系

| 仓库 | 做什么 |
|------|--------|
| `alivedou/CF-nav` `v4` | 真正的导航站，按方案分阶段改 |
| 本仓库 | 只展示诊断和计划，方便对照阅读 |

要在 CF-nav 里落地某一阶段时，直接在那个仓库开工，不要把业务搬到这里。

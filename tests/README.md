# 测试怎么跑

在仓库根目录：

```bash
npm install
npm run test:capture    # 空库打一遍契约，写入 tests/fixtures/baseline/contract.json
npm run test:baseline   # 每阶段合并前
npm run test:phase0     # 阶段 0 卫生
```

数据写在 `tests/.tmp/`（已 gitignore），通过 `DB_PATH` + `KV_DIR` 与开发者的 `local_d1.db` / `local_kv/` 隔离。

Bing 壁纸依赖外网：状态允许 200 或 500，快照比较时按「可探测」归一，避免网络抖动误杀重构。

# CloudNav 完善阶段待办事项 (Combat Map) - V3

## 📦 Phase 25: 禅意模式下网址卡片点击失效修复 (Zen Mode Click Fix)
- [x] **Task 25.1: 深度排查“点击穿透”屏障 (CSS 层级审计)**
    - 检查 `style.css` 中 `.zen-active` 和 `.zen-silent` 对 `pointer-events` 的操作，排查背景遮罩层（Mask）或侧边栏容器对内容区的拦截。已修复 `zen-active` 状态下未正确恢复 `pointer-events` 的问题。
- [x] **Task 25.2: 隔离视图事件绑定链路校验 (JS 逻辑审计)**
    - 审计 `app.js` 中的 `renderNav` 和 `openLink` 函数，确保在隔离模式（Isolated View）下生成的卡片正确响应点击。已优化卡片点击处理逻辑，利用原生链接跳转确保稳定性。
- [x] **Task 25.3: 交互反馈优化与兼容性验证**
    - 在本地 WSL 环境下验证跳转流畅度，确保常规隔离和禅意隔离路径均正常。已完成全链路回归测试，交互逻辑达到原生稳定性。
- [x] **Phase 25: 禅意模式下网址卡片点击失效修复 已全部完成**

## 📦 Phase Search: 召唤式搜索 (Summoned Search) 优化
- [x] **Task S.1: CSS 层叠与动画重构 (Overlay Architecture)**
    - 将 `.search-section` 改造成全屏 Overlay。
    - 实现常规模式下的默认隐藏，以及唤起时的模糊背景与缩放效果。
    - 处理搜索结果下拉框在居中模式下的适配。
- [x] **Task S.2: 全局键盘监听与“盲打”唤起 (Type-to-Search)**
    - 在 `app.js` 中增加全局 `keydown` 监听。
    - 实现智能识别字符输入，自动呼出搜索框并填入首个字符。
    - 兼容 `Esc` 退出和常用快捷键（如 `/` 或 `Ctrl+K`）。
- [x] **Task S.3: 多端适配与交互细节优化**
    - 针对移动端，在右上角或禅意模式下添加显式的搜索唤起入口。
    - 优化搜索框出现后的焦点管理，确保流畅的输入体验。
    - 确保禅意模式与常规模式下的搜索体验一致且不冲突。

## 📦 Phase Notice: 公告系统入口归一化 (UI Cleanup)
- [x] **Task N.1: HTML 结构除重与冗余清理**
    - 移除 `index.html` 中重复的 `sidebar-announce-slot` ID。
    - 移除侧边栏底部（footer）旧版的公告铃铛占位符。
- [x] **Task N.2: JS 渲染逻辑剥离与重构**
    - 查找并移除 `app.js` 中向底部注入“闪烁铃铛”的旧代码。
    - 确保 `refreshNoticeBadge` 仅控制顶部唯一的公告中心按钮。
- [x] **Task N.3: CSS 动画遗留清理**
    - 移除针对旧版铃铛的 `breath` 或 `flash` 等闪烁动画样式。
    - 优化顶部 `notice-dot` 的视觉一致性。

## 📦 Phase Sync: 个性化设置提交性能优化 (Batch Sync)
- [x] **Task O.1: 引入离线状态管理机制**
    - 增加 `isSettingsDirty` 全局标识。
    - 修改 `setVisualSetting` 与 `toggleZenMode`，使其优先更新本地内存与 LocalStorage，避免高频请求。
- [x] **Task O.2: 重构“视觉实验室”交互流**
    - 激活 `edit-modal` 的确认按钮作为“保存并应用到云端”的显式入口。
    - 在弹窗内显示“待同步”提示，增强用户心理预期。
- [x] **Task O.3: 闭环同步机制实现**
    - 在关闭弹窗（点击遮罩、关闭按钮、Esc）时检测 `isSettingsDirty` 并执行单次全量同步。
    - 确保在页面刷新或异常关闭前尝试进行最后一次同步。

## 📦 Phase Sync+: 全面暂存与反馈优化 (Optimistic UI & Feedback)
- [x] **Task O+.1: 状态标识与提示语语义化重构**
    - 将 `isSettingsDirty` 升级为全局 `isDataDirty` 标识，涵盖个性化与内容修改。
    - 修改所有即时反馈的 Toast 提示，区分“预览中/待保存”与“云端同步成功”。
- [x] **Task O+.2: 页面管理逻辑暂存化**
    - 移除页面管理（排序、编辑分类、隐藏、删除）中的立即同步调用。
    - 确保所有内容变动仅在本地内存生效并标记“脏数据”。
- [x] **Task O+.3: 退出链路与批量同步闭环**
    - 在退出页面管理模式（按钮点击或 Esc）时触发单次全量云端同步。
    - 确保视觉实验室与页面管理共用同一套优雅的同步反馈逻辑。

## 📦 Phase Sync++: 交互逻辑深度对齐 (Logic Refinement)
- [x] **Task O++.1: 重构全局清理函数支持“静默模式”**
    - 为 `closeAllModals` 增加 `silent` 参数，防止在刷新 UI 弹窗时触发误同步。
- [x] **Task O++.2: 修正个性化设置的内部刷新链路**
    - 在 `openVisualLab` 内部调用时启用静默模式。
    - 统一修正 `setVisualSetting` 和 `toggleZenMode` 的反馈语，杜绝“预览态”出现“云端”字样。
- [x] **Task O++.3: 页面管理模式反馈语全量对齐**
    - 审计并修正页面管理中的所有 Toast 提示，确保在点击“退出”前完全处于“本地暂存”语义。已完成全量对齐，杜绝预览态“云端”字样。

## 📦 Phase final: 性能审计与生产准备 (ps：放到最后要做的。)
- [ ] **Task 1: 性能瘦身与 Z-index 审计**
- [ ] **Task 2: PWA 与离线体验补强**
- [ ] **Task 3: 自动化部署套件**
---
*注：之前的基础建设 Phase 1-3 已成功执行。*
*最后更新日期: 2026-05-29*

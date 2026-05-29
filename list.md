# CloudNav 完善阶段待办事项 (Combat Map) - V2

## 🛠️ Phase 4: 交互进化与管理重构 (Refinement)
- [x] **Task 4.1: 侧边栏架构重组 (Sidebar Logical Grouping)**
    - 重构侧边栏 HTML/JS 渲染逻辑，划分为：创作、控制、视觉、底层。
    - 增加管理员模式下的“侧边栏视觉区分”逻辑。
- [x] **Task 4.2: 视觉实验室开发 (Visual Laboratory)**
    - 实现网格密度（紧凑/标准/舒适）实时调节及持久化。
    - 实现侧边栏风格（经典/彩色）实时切换逻辑。
    - 补齐“禅意模式”显式控制开关及 `Ctrl+B` 快捷键。
- [x] **Task 4.3: 页面管理模式深度闭环 (Management Loop)**
    - 在侧边栏增加分类管理快捷按钮（重命名/显隐）。
    - 优化批量操作条，支持“批量分类移动”与“状态切换”。
    - 增强 Admin Banner 的交互与警告提示。
- [x] **Task 4.4: 管理中心 (Admin Hub) 模块化增强**
    - 完善公告管理页面的发布/归档/预览工作流。
    - 补全全局注册/邀请策略的可视化控制面板。

## 🎨 Phase 4.5: 视界进化与深度体验 (Visual & UX Evolution)
- [x] **Task 4.5.1: 视图模态切换 (View Mode Toggle)**
    - 实现“单分类隔离渲染”开关，支持在“长页纵览”与“单视图隔离”中切换。
    - 添加流畅的分类切换转场动画。
- [x] **Task 4.5.2: 侧边栏管理 UI 深度重构 (Sidebar Management Refinement)**
    - 管理态下侧边栏项转为“卡片样式”，增加书签数量预览（如：社交媒体 [12]）。
    - 优化拖拽手柄视觉与显隐状态的高亮反馈。
- [x] **Task 4.5.3: 侧边栏“图钉/悬浮”逻辑 (Sidebar Pin/Float)**
    - 增加固定/悬浮切换逻辑，支持大屏固定占位与悬浮抽屉态切换。
- [x] **Task 4.5.4: 视觉风格差异化增强 (Visual Style Plus)**
    - 强化彩色模式的“色块区隔”设计；细化经典模式的“极简弱边框”。
- [x] **Task 4.5.5: 管理态安全感知 (Admin Safety Feedback)**
    - 管理模式开启时，主页面增加“边框脉冲”动效，强化特权操作感知。

## � Phase 4.6: 核心搜索与导航进阶 (Search & Nav Evolution)
- [x] **Task 4.6.1: 禅意首屏“静默-唤醒”闭环**
- [x] **Task 4.6.2: 搜索历史与智能回溯 (Search Intelligence)**
- [x] **Task 4.6.3: 强制单视图隔离 (Strict Isolation)**
- [x] **Task 4.6.4: 移动端边缘滑动抽屉 (Swipe Engine)**

## 🛠️ Phase 4.7: 系统稳定性与交互恢复 (Recovery & Stability)
- [x] **Task 4.7.1: 全局初始化链路加固**
- [x] **Task 4.7.2: 快捷键引擎重构 (Shortcuts Engine)**
- [x] **Task 4.7.3: 禅意模式视觉死锁解开**
- [x] **Task 4.7.4: 导航视界与内容可见性修复**
- [x] **Task 4.7.5: 系统逻辑解耦与自愈 (Recovery & De-coupling)**

## 🛠️ Phase 4.8: 侧边栏管理工具收纳与解耦 (Tools Integration)
- [ ] **Task 4.8.1: 管理工具子菜单化**
    - 重构 renderTools，将专家模式、备份导出等 5 个按钮整合为“页面管理”的子菜单。
- [ ] **Task 4.8.2: 深度状态重置 (Zero Residual)**
    - 完善退出管理模式时的清理逻辑，确保视觉与内存状态双重回归。
## 🎨 Phase 4.9: 网址视界增强 (Navigation View Enhancement)
- [x] **Task 4.9.1: CSS 气泡样式优化 (Tooltip Styling)**
    - 优化 `data-tooltip` 视觉表现（圆角、毛玻璃、弹性动画、最大宽度）。
    - 解决卡片 `overflow: hidden` 导致气泡被截断的显示问题。
- [x] **Task 4.9.2: 渲染逻辑注入 (Render Logic Injection)**
    - 修改渲染循环，动态注入 `desc` 到 `data-tooltip` 属性。
    - 同步更新 `title` 属性作为兼容性方案。
- [x] **Task 4.9.3: 交互场景适配 (UX Refinement)**
    - 优化管理模式与移动端的交互感知，确保描述显示不遮挡核心操作。
    - 移动端触屏场景下自动屏蔽 hover 气泡以防误触。
## 🎨 Phase 4.10: 侧边栏精简与功能归口 (Sidebar UI Streamlining)
- [x] **Task 4.10.1: 侧边栏冗余 UI 清理 (UI Cleanup)**
    - 从 `index.html` 移除无效的样式切换按钮，清理 CSS 冗余样式。
- [x] **Task 4.10.2: 视觉实验室逻辑校验 (Logic Alignment)**
    - 确保 `sidebarStyle` (classic/colorful) 在“视觉实验室”中正常运作并同步云端。## 🛠️ Phase 4.11: 管理中心交互体验修复 (Admin Hub UX Fix)
- [x] **Task 4.11.1: 增强 Tab 节点属性标识 (DOM Attributes)**
    - 为管理 Tab 按钮注入 `data-tab` 属性，消除对文本匹配的依赖。
- [x] **Task 4.11.2: 修复高亮错位逻辑 (Highlighting Logic)**
    - 重构 `switchHubTab`，实现基于 `data-tab` 的精确高亮反馈。

## 🎨 Phase 4.12: 侧边栏 space 压缩与交互进化 (Sidebar Space Optimization)
- [x] **Task 4.12.1: 管理工具栏结构重组 (Structure Refactoring)**
    - 将底部管理项改为水平并排，移除文字标签并注入 `data-tooltip`。
- [x] **Task 4.12.2: 工具栏视觉表现优化 (Visual & CSS)**
    - 定义横向工具栏样式，优化气泡弹出位置与层级。

## 🎨 Phase 4.13: 全局气泡提示系统 (Global Tooltip System)
- [x] **Task 4.13.1: 气泡提示样式全局化 (Global Tooltip CSS)**
    - 重构 CSS，使 `data-tooltip` 属性支持侧边栏按钮等非卡片元素。
- [x] **Task 4.13.2: 侧边栏溢出显示修正 (Sidebar Clipping Fix)**
    - 确保侧边栏底部按钮的气泡不被父容器截断。

## �️ Phase 4.14: 侧边栏气泡深度修复 (Sidebar Tooltip Deep Fix)
- [x] **Task 4.14.1: 侧边栏容器溢出穿透 (Overflow Piercing)**
    - 修改 `style.css`，放开 `.sidebar-footer` 和 `.sidebar-admin-container` 的溢出限制。
- [x] **Task 4.14.2: 按钮项裁剪逻辑重构 (De-clipping)**
    - 针对带气泡的按钮强制设置 `overflow: visible`，让气泡破框而出。
## 🎨 Phase 4.15: 侧边栏动作聚合与布局优化 (Action Aggregation)
- [x] **Task 4.15.1: 登录/登出动作下沉 (Action Sinking)**
    - 将登录/登出按钮从顶部移除，以图标形式集成到底部工具栏。
- [x] **Task 4.15.2: 极简身份展示 (Identity Simplification)**
    - 重塑顶部用户信息区域，仅保留身份展示，移除冗余交互。
## 🎨 Phase 4.16: 体验模态语义化增强 (Experience Modality Enhancement)
- [x] **Task 4.16.1: 视觉实验室 UI 重构 (Radio Buttons)**
    - 将单一禅意模式开关替换为“常规”与“禅意”互斥按钮组。
- [x] **Task 4.16.2: 逻辑集成与状态持久化 (Logic Integration)**
    - 确保互斥切换逻辑与快捷键体验完美融合。
## 🎨 Phase 4.17: 内容组件自定义化 (Component Customization)
- [x] **Task 4.17.1: 视觉实验室组件开关重构 (UI Refinement)**
    - 在视觉实验室增加“常去网站”显隐控制按钮组。

## 🛠️ Phase 5: 双模导航深度重构 (Zen vs Standard)
- [x] **Task 5.1: CSS 沉浸态基础架构 (T1)**
    - 优化 `zen-silent` 状态下的全屏居中布局，确保搜索框处于视觉中心。
    - 强化侧边栏及内容区的消隐过渡动效，解决“瞬间闪现”问题。
- [x] **Task 5.2: 双模调度逻辑实现 (T2)**
    - 完善模式切换时的状态机流转（Zen <-> Standard）。
    - 绑定 `Ctrl+B` 与 `Esc` 的深度场景响应逻辑。
- [x] **Task 5.3: 单一视图隔离渲染 (T3)**
    - 确保禅意模式强制开启“单分类隔离”，并优化分类切换时的骨架屏或平滑加载。
- [x] **Task 5.4: 多维智能唤醒机制 (T4)**
    - 优化鼠标位移、敲击键盘、背景点击的唤醒灵敏度与防抖处理。
- [x] **Task 5.5: 跨端手势与配置持久化 (T5)**
    - 补齐移动端上滑唤醒手势，并确保所有模式偏好在 D1/KV 中实时落库。
- [x] **Task 4.17.2: 渲染逻辑闭环与持久化 (Logic Integration)**
    - 确保 `renderNav` 遵循 `showFrequent` 配置，并同步云端。
## �📦 Phase 5: 性能审计与生产准备 (Production Ready)
- [ ] **Task 5.1: 性能瘦身与 Z-index 审计**
- [ ] **Task 5.2: PWA 与离线体验补强**
- [ ] **Task 5.3: 自动化部署套件**

---
*注：之前的 Phase 1-3 (核心链路、安全加固、后台闭环) 已成功执行并合入主分支。*
*最后更新日期: 2026-05-28*

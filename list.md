# CloudNav 完善阶段待办事项 (Combat Map) - V3

## 📦 Phase final: 性能审计与生产准备
- [ ] **Task 1: 性能瘦身与 Z-index 审计**
- [ ] **Task 2: PWA 与离线体验补强**
- [ ] **Task 3: 自动化部署套件**

## 🧪 Phase Extra: 可选增强模块 (Optional Enhancements)
- [ ] **Task E.1: [R2 存储] 环境自适应架构实现 (支持 R2 绑定自动激活上传功能)**
- [ ] **Task E.2: [R2 存储] 完善图片上传/缩放/自动清理逻辑 (仅当 R2 开启时)**
- [ ] **Task E.3: [UI] 视觉实验室背景区增加“上传/链接”弹性切换组件**
---
*注：之前的基础建设 Phase 1-3 已成功执行。*

## 🛠️ Phase: 用户管理 Dashboard 深度重构 (升级版)
- [x] **Task UM.1: 后端 API 增强** - 改造 `/api/admin/users.js` 支持搜索、筛选与分页
- [x] **Task UM.2: CSS 视觉装配** - 为搜索面板、分页组件、多选工具栏提供样式支持
- [x] **Task UM.3: 前端交互实现 - 搜索与筛选** - 实现折叠式面板与实时防抖搜索
- [x] **Task UM.4: 前端交互实现 - 多选与批量操作** - 实现 Checkbox 选择逻辑与浮动操作栏
- [x] **Task UM.5: 前端交互实现 - 分页逻辑集成** - 实现无刷新分页请求与数据渲染
- [x] **Task UM.6: 前端功能增强 - CSV 批量导出** - 实现管理端数据的客户端无压导出
- [x] **Task UM.7: 权限安全补强 (Security Lockdown)**
    - [x] **UM.7.1 (后端)**: 改造 `users.js` 逻辑，禁止提拔新 `admin`
    - [x] **UM.7.2 (后端)**: 增加管理员总数配额校验
    - [x] **UM.7.3 (前端)**: 动态过滤角色下拉菜单，隐藏 “Admin” 选项
    - [x] **UM.7.4 (前端)**: 对 Super User 禁用角色切换功能

## 🛠️ Phase: Root 权限体系与职能分离重构 (Functional Decoupling)
- [x] **UM.8.1 (后端)**: 改造 `users.js` 识别 Root 身份 (ID=1) 并解锁 Admin 提拔逻辑
- [x] **UM.8.2 (后端)**: 完善 `DELETE` 和 `Password Reset` 逻辑，强制二次验证与审计
- [x] **UM.8.3 (前端)**: 改造用户管理 Dashboard，移除角色修改，集成【重置密码/删除】操作
- [x] **UM.8.4 (前端)**: 在系统配置菜单新增“角色授权”子菜单，复用搜索组件
- [x] **UM.8.5 (前端)**: 统一全局操作密码 Prompt 拦截与审计日志入库逻辑

*最后更新日期: 2026-05-30*

## 🛠️ Phase: 管理员限额与超级用户职能细化 (Admin Cap & SU Quota)
- [x] **Task AC.1: 后端权限硬核校验** - 在 `users.js` 强制 5 人管理员上限，且仅限 UID=1 执行 Admin 提拔。
- [x] **Task AC.2: 系统配置扩展** - 在 `site-config.js` 增加 `super_user_invite_quota` 动态配额字段。
- [x] **Task AC.3: 前端交互适配** - 角色授权页面显示管理员名额状态 (x/5)，名额满时置灰或提示。
- [x] **Task AC.4: 审计权限收拢** - 确保敏感审计日志查看权限仅对 Admin 开放，SU 权限受限。

## 🛠️ Phase: 公告管理中心 2.0 (The Bulletin Redux)
- [x] **Task AN.1: 后端 API 增强** - 改造 `announcements.js` 支持搜索、筛选与分页。
- [x] **Task AN.2: 前端 UI 结构复用** - 公告管理面板嵌入搜索面板与标准表格结构。
- [x] **Task AN.3: 前端交互实现** - 实现多选、批量操作、分页与搜索防抖。
- [x] **Task AN.4: 公告编辑增强** - 优化发布逻辑，支持展示层级、置顶设置与权限隔离。

## 🛠️ Phase: 全站管理组件标准化 (Admin Standard Suite)
- [x] **Task STD.1: 后端 API 标准化** - 改造 `invitations.js` 和 `audit-logs.js` 支持搜索、筛选与分页。
- [x] **Task STD.2: 邀请管理重构** - 复用标准表格、搜索面板与批量处理逻辑。
- [x] **Task STD.3: 审计日志重构** - 实现全量物理分页、动作类型筛选与视觉强化。

## 🛠️ Phase: 管理端健壮性与 Bug 修复 (Hub Robustness & Hotfix)
- [x] **Task FIX.1: 补全全局状态变量** - 修复 `adminSelectedInviteIds` 等变量未定义导致的崩溃。
- [x] **Task FIX.2: 完善重置与加载逻辑** - 确保 `openAdminHub` 初始化时同步清理所有模块状态。
- [x] **Task FIX.3: 健壮性检查** - 补齐配套 UI 更新函数，确保 Tab 切换流无鬼影状态。

## 🛠️ Phase: 本地环境对齐与数据展示修复 (Dev Parity & Data Fix)
- [x] **Task DP.1: 补全本地用户查询字段** - 修复 `server.js` 缺失 `uid` 导致的 `undefined` 展示问题。
- [x] **Task DP.2: 同步本地搜索与分页逻辑** - 让本地 API 支持搜索、状态筛选及管理员名额统计。
- [x] **Task DP.3: 前端 UID 渲染优化** - 增加渲染容错，确保在任何环境下均有优雅展示。
- [x] **Task DP.4: 全站身份标识对齐** - 侧边栏优先显示友好 UID，增加鼠标悬浮查看完整 ID 功能。

## 🛠️ Phase: 审计日志视觉体验优化 (Audit Log UX Polish)
- [x] **Task AL.1: 动作语义化映射** - 将 `DELETE_USER` 等技术名称转换为友好的中文 Badge。
- [x] **Task AL.2: 时间轴双行排版** - 时间列分为“年月日”与“时分秒”两行展示，优化空间。
- [x] **Task AL.3: 筛选器中文对齐** - 同步汉化日志检索面板的动作类型选项。

## 🛠️ Phase: 用户资源配额系统完善 (User Quota System)
- [x] **Task UQ.1: 修正中间件权限拦截逻辑** - 允许 `/api/config` 探测并注入角色信息
- [x] **Task UQ.2: 后端配额动态注入优化** - `config.js` 强制下发实时配额数据
- [x] **Task UQ.3: 前端 UI 响应式适配与硬编码清理** - 清理 `app.js` 默认值并增加配额提示
- [x] **Task UQ.4: 后端保存操作的硬核校验** - 已在 `config.js` 实现拦截并验证通过

## 🛠️ Phase: 交互增强 - 分类自由排序 (Category Reordering)
- [x] **Task CAT.1: 侧边栏结构适配** - 增加拖拽手柄视觉引导与容器标识
- [x] **Task CAT.2: SortableJS 侧边栏集成** - 初始化侧边栏拖拽实例并限制手柄触发
- [x] **Task CAT.3: 排序状态同步与持久化** - 监听排序结束事件并同步云端数据

## 🛠️ Phase: 退出管理逻辑优化 (Management Exit Optimization)
- [x] **Task EXIT.1: 退出管理自动保存与引导** - 优化退出逻辑，支持配置化云端同步并增强引导提示
- [x] **Task EXIT.2: 同步中心配置扩展** - 在同步中心增加“退出时自动同步”开关
- [x] **Task EXIT.3: 游客退出逻辑专项优化** - 实现物理隔离与引导式保存提示
- [x] **Task EXIT.4: 全站退出保存逻辑统一** - 个性化设置退出时应用同样的保存与引导逻辑
- [x] **Task SYNC.4: 逻辑物理隔离** - 区分个人暂存与全局管理即时生效逻辑
- [x] **Task SYNC.5: 主题本地化隔离** - 确保主题切换纯本地执行，不干扰脏数据标记

## 🛠️ Phase: 性能优化 - 退出登录同步策略 (Logout Sync Strategy)
- [x] **Task SYNC.1: 策略字段迁移与重命名** - 切换为 `autoSyncOnLogout` 并更新 UI
- [x] **Task SYNC.2: 编辑器退出逻辑降级** - 退出管理时仅本地保存，减少 API 压力
- [x] **Task SYNC.3: 退出登录拦截与强制同步** - 退出时检测脏数据并强制执行云端同步

## 🛠️ Phase: 资源节流补强 - 备份频率与冷却限制 (Quota & Rate Limiting Enhancements)
- [x] **Task節流.1: 调整默认备份策略** - 修改新用户初始化的 `syncInterval` 为 7 天
- [x] **Task節流.2: 实现手动备份冷却逻辑** - 限制手动同步频率（5 分钟冷却期）
- [x] **Task節流.3: 同步中心 UI 增强** - 显示冷却状态与默认策略提示
- [x] **Task EXIT.5: 交互一致性优化** - 统一侧边栏同步按钮样式与弹窗内说明


## 🛠️ Phase: 云端同步中心逻辑精简 (Sync Center Streamlining)
- [x] **Task SYNC.REFACTOR.1: 逻辑层整合** - 新增 `setSyncMode(days)` 统一入口，同步更新 `autoSyncOnLogout` 和 `syncInterval`
- [x] **Task SYNC.REFACTOR.2: UI 模板重构** - 合并“同步偏好”与“自动化调度”区块，精简同步中心界面
- [x] **Task SYNC.REFACTOR.3: 交互增强 (Dirty Data Hint)** - 手动模式下为“上传到云端”增加未保存数据高亮提示
- [x] **Task SYNC.REFACTOR.4: 冗余清理** - 移除 `setAutoSyncOnLogout` 等旧函数，确保逻辑闭环

## 🛠️ Phase: 智能同步护盾 (Smart Sync Guard - Server Protection)
- [x] **Task SYNC.GUARD.1: 退出同步逻辑的“冷却时间”补强** - 退出时增加 5 分钟冷却拦截，防止频繁登入登出导致的重复写操作
- [x] **Task SYNC.GUARD.2: 实现“实质性修改”指纹校验** - 仅在分类或网址等核心数据发生实质变更时触发自动同步
- [x] **Task SYNC.GUARD.3: 同步状态双向重置** - 确保所有同步路径成功后均能准确重置脏数据标记与时间戳

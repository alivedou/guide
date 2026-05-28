# CloudNav 重构进度看板 (Combat Map)

## 🏗️ Phase 1: 账号体系与多租户隔离
- [x] **Task 1.1: 修复 Auth UI 交互状态机** (已实现 Admin 勋章、登录后状态实时同步与 Alt+L 快捷键)
- [x] **Task 1.2: D1 事务级注册逻辑** (已实现 DB.batch 原子化注册，首位用户自动晋升 Admin)
- [x] **Task 1.3: 权限与角色判定 (ACL)** (已实现后端 D1 实时角色校验，多租户 KV 数据完全隔离)

> **工程师加固说明** (2026-05-28): 
> - 解决了“侧边栏隐藏导致无法登录”的死锁问题。
> - 新增 `Alt + L` 全局快捷键唤起登录。
> - 新增极简模式下的“游客引导链接”。
> - 将侧边栏切换按钮设为 `fixed` 常驻。

## 🔍 Phase 2: 极致搜索与沉浸式交互 (4.1)
- [x] **Task 2.1: Zen Mode 状态机与过渡动画** (实现首屏中心聚焦、搜索唤醒、以及平滑的淡入淡出动画)
- [x] **Task 2.2: 全局键盘钩子 (Keyboard Hooks)** (集成 Ctrl+B 侧边栏、Ctrl+K 聚焦、Esc 复位及“键入即搜索”功能)
- [x] **Task 2.3: 智能常去网站算法** (优化为 7 日滑动窗口自动衰减算法，确保数据实时性)

## 🎨 Phase 2.5: 交互细节加固 (体验闭环) - [REINFORCED]
- [x] **Task 2.5.1: 全场景沉浸唤醒** (实现移动端上滑/背景智能判定/弹性动效曲线)
- [x] **Task 2.5.2: 搜索视图深度隔离** (实现 35px 高斯模糊隔离/站内模糊匹配/键盘索引/回车直达)
- [x] **Task 2.5.3: 全键盘磁贴流转** (实现焦点环脉冲/网格列数实时计算/视距锁定)
- [x] **Task 2.5.4: 点击统计云端同步** (实现 Beacon 离场同步/指数退避重试机制)

## 🏗️ Phase 2.6: 工程化加固与 Edge 适配
- [x] **Task 2.6.1: 鉴权环境 Edge 化** (从 `jsonwebtoken` 迁移至 `jose`，实现 Cloudflare Workers 100% 原生兼容)
- [x] **Task 2.6.2: 预览脚本增强** (完善 `package.json` 脚本，补齐 D1 数据库本地绑定预览功能)
- [x] **Task 2.6.3: 代码规范初始化** (引入 ESLint & Prettier，建立工业级代码质量约束)

## 🛠️ Phase 3: 自动化管理与图标自愈 (4.2/4.4)
- [x] **Task 3.1: 6 级图标自愈引擎** (级联降级策略：原站 -> iowen -> QQ -> Google -> DuckDuckGo -> 文字兜底)
- [x] **Task 3.2: 魔法棒 (Magic Wand) 自动化采集** (后端 HTMLRewriter 抓取 metadata，实现标题/描述/图标一键填入)
- [x] **Task 3.3: 页面管理 (Page Management) 深度集成** (实现 SortableJS 跨分类拖拽排版与实时防抖云同步)
- [x] **Task 3.4: 批处理工具栏 (Batch Bar)** (多选模式支持、批量移动分类与一键物理删除)
- [x] **Task 3.5: 导入/导出与 JSON 专家模式** (集成 Monaco Editor 实现代码级配置修改与本地 JSON 备份)

## 🛡️ Phase 4: 全站管控中心 (4.3)
- [x] **Task 4.1: 管理员管控枢纽 (Admin Hub)**
    - [x] **后端**: 实现 `/api/admin/users` 分页查询与 `active/frozen` 状态熔断逻辑。
    - [x] **审计**: 在 D1 `audit_logs` 记录所有管理员高危操作。
    - [x] **配置**: 实现 `/api/admin/site-config` 接口，支持全站 Title/Logo/SEO 实时下发。
- [x] **Task 4.2: 多态公告下发系统 (Broadcast)**
    - [x] **渲染引擎**: 前端实现 `Important` (顶部横幅) 与 `Quiet` (右下角铃铛) 渲染组件。
    - [x] **下发逻辑**: 公共接口 `/api/announcements` 动态分发已发布且未过期的通告。
    - [x] **已读闭环**: 利用 `localStorage` 实现公告关闭后的静默逻辑，避免重复骚扰。
- [x] **Task 4.3: 云端资源配额与风控 (Guardrail)** (后端强制执行 20 cats/100 items 限制，并补全 Token 过期校验机制)
- [x] **Task 4.4: 邀请制与注册策略**
    - [x] **存储**: D1 新增 `invitation_codes` 表，KV `site_config` 新增注册开关字段。
    - [x] **后端**: `register.js` 接入邀请码校验与注册策略判别逻辑。
    - [x] **管理**: `Admin Hub` 新增邀请码管理页，支持批量生成、导出与策略切换。
    - [x] **UI**: 注册界面适配邀请码输入，提供策略状态反馈。

## 📱 Phase 5: 跨端一致性与 PWA (4.5)
- [x] **Task 5.1: 智能 ServiceWorker (PWA & 高级缓存)**
    - [x] **预缓存**: 实现 `ServiceWorker.js` 核心资产预载与 Stale-While-Revalidate 策略。
    - [x] **图标镜像**: 实现对“魔法棒”第三方图标的 Cache-First 拦截缓存。
    - [x] **元数据**: 动态同步 `theme-color` 至 `manifest.json` 与系统状态栏。
- [x] **Task 5.2: 响应式手势与断点 (Mobile UX)**
    - [x] **手势引擎**: 实现移动端左滑唤醒、右滑隐藏侧边栏抽屉手势。
    - [x] **断点微调**: 针对 Pad 和折叠屏优化三列网格布局与内边距。
    - [x] **反馈一致性**: 确保所有触控操作具备明确的视觉按压反馈。

## 🛠️ Phase 5.5: 本地模拟环境补全 (Local Dev Sync)
- [x] **Task 5.5.1: 修复管理后台加载报错** (解决 Unexpected token '<' 问题)
- [x] **Task 5.5.2: 补全 server.js 管理端 API 积木**
    - [x] 1. 实现 `adminOnly` 鉴权中间件。
    - [x] 2. 实现用户管理接口 (列表获取、冻结/解冻状态同步)。
    - [x] 3. 实现全站配置接口 (Site Config 模拟 KV 持久化)。
    - [x] 4. 实现邀请码管理接口 (批量生成、删除、状态关联查询)。
- [x] **Task 5.5.3: 同步本地注册风控逻辑** (注册时校验邀请码与全站策略)。
- [x] **Task 5.5.4: 本地数据库自动热迁移** (自动补齐 status/role 字段)。
- [x] **Task 5.5.5: 开发环境登录调试增强** (增加详细日志输出)。

## ✨ Phase 6: 体验打磨与“出厂”校验
- [x] **Task 6.1: 引导系统 (Onboarding)** (新用户首次登录自动填充 `system_default.json` 模板数据)
    - [x] **工业级重置兜底**: 实现“模板 -> 内置 -> 硬兜底”的阶梯加载逻辑。
- [ ] **Task 6.2: 性能审计与瘦身** (清理冗余 CSS、压缩 KV 存储结构并进行全站加载速度优化)
- [x] **Task 6.3: 生产环境数据持久化补全** (D1 & KV Sync)
    - [x] 1. **注册原子化注入**: 修改 `register.js` 在注册事务中同步向 D1 插入初始数据。
    - [x] 2. **配置事务持久化**: 修改 `config.js` 的 POST/DELETE 接口，实现 D1 事务与 KV 同步。
    - [x] 3. **动态模板支持**: 生产环境注册优先读取 KV 中的 `system:onboarding_template`。
- [x] **Task 6.4: 安全加固与审计闭环** (Edge Security)
    - [x] 1. **边缘端登录熔断**: 在 `login.js` 引入基于 IP 的故障计数器 (KV 存储)。
    - [x] 2. **审计记录全覆盖**: 在邀请码及公告管理 API 中补全审计日志。
- [ ] **Task 6.5: 工程化部署准备** (编写 `wrangler.toml` 与 CI/CD 部署脚本)

---
*最后更新日期: 2026-05-28*
ps:  程序将默认在本地的 **`http://localhost:3000`** 端口上启动，并生成并读取本地 `kv_mock.json` 配置文件。

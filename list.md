# CloudNav 完善阶段待办事项 (Combat Map) - V3

## 📦 Phase 12: 自定义背景与视觉增强 (Background & Visual Enhancement)
- [x] **Task 12.1: 实现 Bing 壁纸 12 小时缓存机制**
    - 实现 `getBingWallpaper` 工具函数，包含 LocalStorage 时间戳过期校验（12h）。
    - 确保在用户未设置自定义背景时，自动平滑切入 Bing 每日高清图。
- [x] **Task 12.2: 视觉实验室 UI 补强**
    - 在设置面板中增加“自定义背景链接”输入框（支持 URL 粘贴）。
    - 增加“背景遮罩”同步开关按钮，用于控制背景暗色覆盖层。
- [x] **Task 12.3: 渲染逻辑与样式对齐**
    - 在 `updateStyles` 中应用背景 URL 和遮罩 CSS 类名。
    - 确保自定义背景与亮/暗色模式的视觉兼容性。
- [x] **Phase 12: 自定义背景与视觉增强 已全部完成**

## 📦 Phase 13: Local Dev 环境背景图适配与容错 (Background Fallback & Dev Sync)
- [x] **Task 13.1: 在本地 `server.js` 补齐 `/api/bing` 代理路由**
    - 确保本地 `npm run dev` 环境能正确转发并获取 Bing 壁纸数据。
- [x] **Task 13.2: 优化 `getBingWallpaper` 的异常捕捉与渲染时机**
    - 增加更详细的调试日志，并在 `init()` 数据加载完成后强制刷新背景。
- [x] **Task 13.3: 增强 CSS 物理底色兜底**
    - 为 `body` 增加深色渐变底色，消除背景图加载前的白屏感。
- [x] **Phase 13: Local Dev 环境背景图适配与容错 已全部完成**

## 📦 Phase 14: 性能审计与生产准备 (ps：放到最后要做的。)
- [ ] **Task 14.1: 性能瘦身与 Z-index 审计**
- [ ] **Task 14.2: PWA 与离线体验补强**
- [ ] **Task 14.3: 自动化部署套件**

## 📦 Phase 15: 禅意模式快捷键与交互修复 (Zen Mode Shortcut & Sidebar Fix)
- [x] **Task 15.1: 样式层级修复 - 确保侧边栏在禅意模式下可见**
    - 修改 CSS 确保 `.sidebar.open` 状态下具有最高显示权重。
- [x] **Task 15.2: 重构 Ctrl+B 快捷键逻辑**
    - 确保 Ctrl+B 在任何模式下都能直接切换侧边栏，不再仅限于唤醒操作。
- [x] **Task 15.3: 新增 Alt+Z 快捷键一键切换模式**
    - 实现常规模式与禅意模式之间的无缝转换。
- [x] **Task 15.4: 交互状态同步优化**
    - 当通过快捷键打开侧边栏时，自动同步唤醒状态，防止设置过程中进入静默。
- [x] **Phase 15: 禅意模式快捷键与交互修复 已全部完成**

## 📦 Phase 16: 背景视觉体验修复与 Bing 壁纸加固 (Background Experience & Bing Fix)
- [x] **Task 16.1: 服务端 Bing 代理加固与区域优化**
    - 切换至 `cn.bing.com` 并补齐 User-Agent，增加超时处理.
- [x] **Task 16.2: 优化 updateStyles 阶梯式背景逻辑**
    - 确保在无自定义 URL 且 Bing 抓取失败时，强制回退到 CSS 渐变底色，而非纯白.
- [x] **Task 16.3: 异步加载占位与平滑过渡补强**
    - 实现“先显旧缓存，异步更同步”的无缝背景切换。
- [x] **Phase 16: 背景视觉体验修复与 Bing 壁纸加固 已全部完成**

## 📦 Phase 17: 壁纸源国内外兼容性加固与视觉占位 (Wallpaper Global Compatibility)
- [x] **Task 17.1: 后端“智能双源”壁纸代理升级**
    - 实现 Bing 官方源与高可用国内镜像源的自动切换，并返回绝对路径。
- [x] **Task 17.2: 前端背景渲染逻辑重构 (URL 解耦)**
    - 适配后端返回的完整 URL，移除前端硬编码的域名拼接逻辑。
- [x] **Task 17.3: 全局视觉占位与底色加固**
    - 在 CSS 中增强 `body` 默认底色，确保图片加载期间呈现高级灰渐变而非纯白。
- [x] **Phase 17: 壁纸源国内外兼容性加固与视觉占位 已全部完成**

## 📦 Phase 18: Bing 背景失效专项修复 (Bing Background Fix)
- [x] **Task 18.1: 后端 URL 标准化输出**
    - 确保 `api/bing` 接口输出的图片 URL 为绝对路径（带 https://www.bing.com）。
- [x] **Task 18.2: 前端缓存校验与自动纠错**
    - 在 `app.js` 中增加对旧有相对路径缓存的识别与自动补全逻辑。
- [x] **Task 18.3: 渲染状态流控与 CSS 底色兜底**
    - 修复 `updateStyles` 中的逻辑空隙，确保在图片未加载完成时显示 CSS 渐变而非白色。

## 📦 Phase 19: 背景显示冲突深度修复 (Background Rendering Conflict Fix)
- [x] **Task 19.1: 样式权限降级 (Style De-prioritization)**
    - 修改 `style.css` 移除 `body.light-theme` 强制渐变，防止覆盖 JS 注入的背景图。
- [x] **Task 19.2: 引入“背景类型”数据标记**
    - 在 `app.js` 设置背景时同步标记 `bg-type`，并在 CSS 中根据类型动态降低遮罩透明度。
- [x] **Task 19.3: 本地开发环境网络链路检查 (Dev Proxy Audit)**
    - 检查 `server.js` 的 `/api/bing` 转发逻辑，确保 WSL 环境下数据抓取 100% 可用。
- [x] **Phase 19: 背景显示冲突深度修复 已全部完成**

## 📦 Phase 20: 链路全通畅与逻辑闭环加固 (Full Link & Logic Closure)
- [x] **Task 20.1: 后端路由重排与“首位”日志**
    - 将 `/api/bing` 路由前置并增加第一时间进入日志，确保请求不被拦截。
- [x] **Task 20.2: 前端初始化逻辑闭环加固**
    - 在云端配置加载完成后增加强制背景校验，解决异步竞争导致的跳过问题。
- [x] **Task 20.3: 前端执行链路监控日志**
    - 在 `app.js` 关键路径增加详细 Console 日志，确诊调用链路断点。
- [x] **Phase 20: 链路全通畅与逻辑闭环加固 已全部完成**

## 📦 Phase 21: 路由冲突彻底清扫与背景恢复 (Route Conflict & BG Recovery)
- [x] **Task 21.1: 后端路由提权与全局请求审计**
    - 将 `/api/bing` 路由移动到 API 逻辑最顶端，并添加全局全流量请求日志。
- [x] **Task 21.2: 修复 site-config 鉴权干扰**
    - 优化 `initSiteConfig` 逻辑，处理游客访问时的 403 干扰，确保控制台清洁。
- [x] **Task 21.3: 前端请求路径与超时加固**
    - 确保 `/api/bing` 请求不被缓存且具备明确的本地指向，排除网络层干扰。
- [x] **Phase 21: 路由冲突彻底清扫与背景恢复 已全部完成**

## 📦 Phase 22: 背景遮罩状态持久化修复 (Background Mask Persistence Fix)
- [x] **Task 22.1: 后端数据库字段补齐与同步加固**
    - 在 `server.js` 中增加 `hide_bg_mask` 字段的自动迁移，并完善 `syncUserToKV` 同步逻辑。
- [x] **Task 22.2: 视觉实验室保存逻辑与状态回显修复**
    - 修正 `openVisualLab` 中的保存函数，确保遮罩开关状态能正确写入云端。
- [x] **Task 22.3: 渲染时机优化确保状态持久显示**
    - 确保 `init()` 数据加载后 `updateStyles` 能准确读取并应用最新的遮罩配置。
- [x] **Phase 22: 背景遮罩状态持久化修复 已全部完成**

## 📦 Phase 23: 全量配置持久化与视图密度保存 (Full Config Persistence & Density Fix)
- [x] **Task 23.1: 后端字段深度全补齐**
    - 在 `server.js` 中增加 `isolated_view` 和 `density` 字段的自动热迁移补丁，并更新初始 SQL 脚本。
- [x] **Task 23.2: 完善 settings 全字段读写映射**
    - 更新 `syncUserToKV` 和 `POST /api/config` 逻辑，确保 `isolatedView` 和 `density` 参与存取。
- [x] **Task 23.3: 视觉实验室全功能回显校验**
    - 确保所有视觉设置（长页/隔离、三种密度、遮罩开关）在刷新后都能根据云端数据正确置亮并应用。
- [x] **Phase 23: 全量配置持久化与视图密度保存 已全部完成**

## 📦 Phase 24: 常规模式与禅意模式浏览逻辑解耦 (Logic Decoupling)
- [x] **Task 24.1: 设置面板 UI 语义化与交互加固**
    - 修改 `openVisualLab` 函数，将“浏览模态”更新为“常规模式 - 浏览模态”，并在禅意模式开启时禁用常规模式的模态切换按钮。
- [x] **Task 24.2: 渲染引擎逻辑解耦 (Rendering Priority)**
    - 在 `updateStyles` 中重构隔离视图判定逻辑，确保禅意模式强制开启隔离且不破坏常规模式偏好。
- [x] **Task 24.3: 交互反馈与 Toast 引导**
    - 在 `setVisualSetting` 中增加状态检查，当在禅意模式下尝试修改常规浏览模态时弹出友好提示。
- [x] **Phase 24: 常规模式与禅意模式浏览逻辑解耦 已全部完成**

---
*注：之前的基础建设 Phase 1-3 已成功执行。*
*最后更新日期: 2026-05-29*

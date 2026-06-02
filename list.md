# CloudNav 完善阶段待办事项 (Combat Map) - V4

## 待修复缺陷 (UI Bugs)
- [x] **缺陷 1**：中央搜索框输入英文字母 `j` 时下延笔画被边缘裁切，导致其辨识为 `i`。 (已修复)
  - *改进点*：为 `#sea-input` 添加上下内边距 `padding: 4px 0 !important`，并设定舒适的 `line-height: 1.4`，扩充垂直渲染边界。
- [x] **缺陷 2**：PC端唤醒搜索框时，由于主内容区域（`.main-content`）带有 transition/will-change 属性，导致 fixed 定位的 `.search-section` 偏移，左侧边栏区域露出未被遮罩覆盖。 (已修复)
  - *改进点*：将 `.search-section` 的 DOM 结构从 `index.html` 中的 `.main-content` 内部移出，提升为平级节点，使其参照浏览器根视区全屏覆盖。
- [x] **缺陷 3**：开启背景模糊后，叠加上书签卡片或分类标题自身的背景模糊，导致嵌套毛玻璃渲染冲突，书签名称与分类文字边缘发虚、字迹模糊。 (已修复)
  - *改进点*：当背景模糊开启时，自动利用 CSS 层级禁用卡片及分类标题的多重 `backdrop-filter`，释放 subpixel 抗锯齿渲染；同时为卡片文本增加微弱阴影和 GPU 字体锐化样式。

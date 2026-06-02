# CloudNav 完善阶段待办事项 (Combat Map) - V4

## 待修复缺陷 (UI Bugs)
- [x] **缺陷 1**：中央搜索框输入英文字母 `j` 时下延笔画被边缘裁切，导致其辨识为 `i`。 (已修复)
  - *改进点*：为 `#sea-input` 添加上下内边距 `padding: 4px 0 !important`，并设定舒适的 `line-height: 1.4`，扩充垂直渲染边界。
- [x] **缺陷 2**：PC端唤醒搜索框时，由于主内容区域（`.main-content`）带有 transition/will-change 属性，导致 fixed 定位的 `.search-section` 偏移，左侧边栏区域露出未被遮罩覆盖。 (已修复)
  - *改进点*：将 `.search-section` 的 DOM 结构从 `index.html` 中的 `.main-content` 内部移出，提升为平级节点，使其参照浏览器根视区全屏覆盖。

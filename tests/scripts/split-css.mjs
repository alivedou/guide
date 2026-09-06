/**
 * One-shot Phase 5 splitter: cut style.css into named sheets without reordering rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS_DIR = path.join(ROOT, 'nav-main/public/assets/css');
const srcPath = path.join(CSS_DIR, 'style.css');
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split('\n');

if (lines.length < 5700) {
  throw new Error(`style.css looks already split (${lines.length} lines)`);
}

function slice(from, to) {
  return lines.slice(from - 1, to).join('\n').trimEnd() + '\n';
}

const files = {
  'tokens.css': {
    banner: 'Design tokens and the early light-theme overrides (kept in original cascade order).',
    body: slice(1, 207).replace(
      '    --primary: #399dff;\n',
      '    --primary: #399dff;\n    --primary-color: var(--primary);\n'
    ),
  },
  'layout.css': {
    banner: 'Simple-mode, reset, visual-lab density, body, and app shell.',
    body: slice(208, 1260),
  },
  'sidebar.css': {
    banner: 'Sidebar, pin, summon, and overlay chrome.',
    body: slice(1261, 1843),
  },
  'cards.css': {
    banner: 'Category sections, bookmark cards, and default grid.',
    body: slice(1844, 2385),
  },
  'modals.css': {
    banner: 'Modals, forms, toast, skeleton, page-manage, video, Monaco, and system preference hooks.',
    body: slice(2386, 3462),
  },
  'responsive.css': {
    banner: 'Shared breakpoint layout (tablet/phone grids, overlay drawer).',
    body: slice(3463, 3675),
  },
  'search.css': {
    banner: 'Search overlay, zen mode, and magic-wand controls.',
    body: slice(3676, 4452),
  },
  'admin.css': {
    banner: 'Admin hub, notices, banners, emoji picker extras, PWA dots, and kbd chrome.',
    body: lines.slice(4452).join('\n').trimEnd() + '\n',
  },
};

for (const [name, { banner, body }] of Object.entries(files)) {
  const out = `/**
 * ${name} — ${banner}
 * Split from style.css with rule order preserved.
 */
${body}`;
  fs.writeFileSync(path.join(CSS_DIR, name), out);
  console.log('wrote', name, out.split('\n').length);
}

const keyboardHelp = `
/* Keyboard shortcut guide (moved off index.html inline styles) */
#keyboard-help-modal {
    z-index: 10500;
}
#keyboard-help-modal .keyboard-help-content {
    max-width: 480px;
    text-align: left;
    position: relative;
}
#keyboard-help-modal .modal-close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    color: #777;
    cursor: pointer;
    font-size: 24px;
}
.keyboard-help-header {
    text-align: center;
    margin-bottom: 20px;
}
.keyboard-help-icon {
    font-size: 36px;
    color: var(--primary);
}
.keyboard-help-header h4 {
    font-size: 16px;
    color: var(--text);
    margin-top: 5px;
}
.keyboard-shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 13px;
    max-height: 480px;
    overflow-y: auto;
    padding-right: 4px;
}
.keyboard-help-group-title {
    font-weight: bold;
    color: var(--primary);
    margin-bottom: 8px;
    border-left: 3px solid var(--primary);
    padding-left: 6px;
    font-size: 13px;
}
.keyboard-help-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.keyboard-help-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--glass-border);
    padding-bottom: 6px;
}
.keyboard-help-row:last-child {
    border-bottom: none;
    padding-bottom: 4px;
}
.keyboard-help-desc {
    color: var(--text-dim);
}
`;

fs.appendFileSync(path.join(CSS_DIR, 'modals.css'), keyboardHelp);
console.log('appended keyboard-help rules to modals.css');

fs.writeFileSync(
  srcPath,
  `/**
 * style.css — compatibility shim for old PWA caches.
 * New pages link the split files directly (tokens first).
 * One-level @import only; do not nest further.
 */
@import url("./tokens.css");
@import url("./layout.css");
@import url("./sidebar.css");
@import url("./cards.css");
@import url("./modals.css");
@import url("./responsive.css");
@import url("./search.css");
@import url("./admin.css");
`
);
console.log('rewrote style.css shim');

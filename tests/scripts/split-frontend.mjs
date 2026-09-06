/**
 * One-shot Phase 4 splitter: ES modules from app.js + user-manage.js.
 * Safe to re-run only on the original classic files (it refuses if features/ already exist).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JS = path.join(ROOT, 'nav-main/public/assets/js');
const FEATURES = path.join(JS, 'features');

const STATE_IDENTS = new Set([
  'appData',
  'activeCatId',
  'sysToken',
  'currentUser',
  'isAdmin',
  'isZenTempExpanded',
  'isActuallyZen',
  'isRendering',
  'lastSyncFingerprint',
  'isPageManagementMode',
  'zenMoveAccumulator',
  'lastMouseX',
  'lastMouseY',
  'isSidebarPinned',
  'selectedIds',
  'sortableInstances',
  'syncTimer',
  'syncRetryCount',
  'touchStartY',
  'currentSearchIndex',
  'historyIndex',
  'searchHistory',
  'simpleMode',
  'currentEnginePrefix',
  'isDataDirty',
  'lastSyncActionTime',
  'currentEditingAnnounceId',
  'lastFocusedElement',
  'adminUserFilters',
  'adminSelectedUserIds',
  'adminAnnounceFilters',
  'adminSelectedAnnounceIds',
  'adminInviteFilters',
  'adminSelectedInviteIds',
  'adminSelectedAuditIds',
  'adminAuditFilters',
  'adminData',
  'navLocalBgImage',
  'cachedAnnouncements',
  'MINIMAL_SAFE_DATA',
  'SyncUI',
]);

const CROSS_FNS = [
  'initThemeMode',
  'manualSyncCloud',
  'escapeHTML',
  'showToast',
  'showLoader',
  'hideLoader',
  'closeAllModals',
  'updateStyles',
  'renderNav',
  'renderTools',
  'toggleSidebar',
  'initSidebar',
  'initZenMode',
  'initSearch',
  'initAuthUI',
  'initGlobalEvents',
  'initAnnouncements',
  'initSiteConfig',
  'initLocalBgImage',
  'getBingWallpaper',
  'handleAuthError',
  'openLoginModal',
  'openNoticeCenter',
  'refreshNoticeBadge',
  'checkSWUpdate',
  'checkAnnouncementsUpdate',
  'initAnnouncementsWatcher',
  'wakeUpNavigation',
  'closeSearch',
  'handleDataSaveOnExit',
  'toggleSkeleton',
  'recordClick',
  'syncClicksToCloud',
  'getFrequentItemsData',
  'formatSystemDate',
  'parseUtcDate',
  'playVideoInline',
  'closeVideoModal',
  'checkAutoSyncSchedule',
  'showTempPasswordChangeAlert',
  'openProfileCenter',
  'showAuthModal',
  'doLogin',
  'doRegister',
  'doLogout',
  'doResetConfig',
  'initSharedPage',
  'renderViralBadge',
  'getCoreDataFingerprint',
  'openJsonEditor',
  'requireAdminAuth',
  'requireSystemConfirm',
  'getEmojiPickerHTML',
  'initEmojiPicker',
  'toggleEmojiPicker',
  'saveItem',
  'init',
  'autoAdjustSidebar',
  'updateNetworkStatus',
  'resetZenSleepTimer',
  'setSearchEngine',
  'openVisualLab',
  'openSyncCenter',
  'toggleZenMode',
  'togglePageManagement',
  'setThemeMode',
  'applyThemeUpdate',
];

function sliceLines(text, from, to) {
  const lines = text.split('\n');
  return lines.slice(from - 1, to).join('\n');
}

function definedNames(src) {
  const names = new Set();
  const re = /^(?:async\s+)?function\s+(\w+)\s*\(|^const\s+(\w+)\s*=/gm;
  let m;
  while ((m = re.exec(src))) {
    names.add(m[1] || m[2]);
  }
  return names;
}

function shouldReplace(node, parent) {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && node === parent.property && !parent.computed) {
    return false;
  }
  if (parent.type === 'Property' && node === parent.key && !parent.computed && !parent.shorthand) {
    return false;
  }
  if (parent.type === 'VariableDeclarator' && node === parent.id) return false;
  if (parent.type === 'FunctionDeclaration' && node === parent.id) return false;
  if (parent.type === 'FunctionExpression' && node === parent.id) return false;
  if (parent.type === 'ClassDeclaration' && node === parent.id) return false;
  if (parent.type === 'LabeledStatement' && node === parent.label) return false;
  if (parent.type === 'CatchClause' && node === parent.param) return false;
  if (
    (parent.type === 'FunctionDeclaration' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'ArrowFunctionExpression') &&
    Array.isArray(parent.params) &&
    parent.params.includes(node)
  ) {
    return false;
  }
  if (parent.type === 'AssignmentPattern' && node === parent.left && parent.parentParams) {
    return false;
  }
  return true;
}

function walk(node, parent, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) {
        if (child && typeof child === 'object' && child.type) walk(child, node, visit);
      }
    } else if (val && typeof val === 'object' && val.type) {
      walk(val, node, visit);
    }
  }
}

function rewriteStateIdents(code) {
  const ast = parse(code, {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: false,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
  });
  const replacements = [];
  walk(ast, null, (node, parent) => {
    if (node.type !== 'Identifier' || !STATE_IDENTS.has(node.name)) return;
    if (!shouldReplace(node, parent)) return;
    if (parent && parent.type === 'Property' && parent.shorthand && node === parent.value) {
      replacements.push({
        start: node.start,
        end: node.end,
        text: `${node.name}: window.${node.name}`,
      });
      return;
    }
    replacements.push({
      start: node.start,
      end: node.end,
      text: `window.${node.name}`,
    });
  });
  replacements.sort((a, b) => b.start - a.start);
  let out = code;
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  return out;
}

function wrappersFor(src) {
  const defined = definedNames(src);
  const lines = [];
  for (const name of CROSS_FNS) {
    if (defined.has(name)) continue;
    if (name === 'escapeHTML') {
      lines.push(
        `const escapeHTML = (...args) => (window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(...args) : String(args[0] ?? ''));`
      );
      continue;
    }
    lines.push(`const ${name} = (...args) => window.${name}(...args);`);
  }
  return lines.join('\n');
}

function featureFile(name, body, extraHeader = '') {
  const rewritten = rewriteStateIdents(body);
  const defined = definedNames(rewritten);
  const assigns = [];
  for (const fn of defined) {
    if (!/^[A-Za-z_$][\w$]*$/.test(fn)) continue;
    if (['dbName', 'storeName'].includes(fn)) continue;
    const alreadyOnWindow = new RegExp(`^window\\.${fn}\\s*=`, 'm').test(rewritten);
    if (alreadyOnWindow) continue;
    assigns.push(`window.${fn} = ${fn};`);
  }
  const header = `/**
 * @fileoverview Feature module: ${name}
 * Split from the former app.js God-file. Window bridge kept for inline onclick.
 */
${extraHeader}${wrappersFor(rewritten)}

`;
  const footer = assigns.length ? `\n// Window bridge for cross-module and inline onclick callers\n${assigns.join('\n')}\n` : '';
  return header + rewritten.trim() + footer;
}

function write(rel, contents) {
  const full = path.join(JS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  console.log('wrote', rel, contents.length);
}

const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');
const searchUx = fs.readFileSync(path.join(JS, 'search-ux.js'), 'utf8');
const userManage = fs.readFileSync(path.join(JS, 'user-manage.js'), 'utf8');

// --- state.js (lets + window getters) ---
const stateBody = `${sliceLines(app, 1, 272)}

let cachedAnnouncements = [];
Object.defineProperty(window, 'cachedAnnouncements', {
    get() { return cachedAnnouncements; },
    set(v) { cachedAnnouncements = v; },
    configurable: true
});
`;
write(
  'features/state.js',
  `/**
 * Shared mutable UI state. Feature modules read/write through window getters.
 */
${stateBody}
`
);

write(
  'features/idb-bg.js',
  featureFile('idb-bg', sliceLines(app, 273, 361))
);

write(
  'features/audit-map.js',
  `/**
 * @fileoverview Feature module: audit-map
 */
${sliceLines(app, 363, 378)}
window.AuditActionMap = AuditActionMap;
`
);

write('features/sync-ui.js', featureFile('sync-ui', sliceLines(app, 380, 442)));

write(
  'features/ui.js',
  featureFile(
    'ui',
    `${sliceLines(app, 573, 662)}
${sliceLines(app, 815, 835)}
`
  )
);

write(
  'features/notices.js',
  featureFile(
    'notices',
    `${sliceLines(app, 527, 556)}
${sliceLines(app, 665, 813)}
${sliceLines(app, 1045, 1261)}
window.refreshNoticeBadge = refreshNoticeBadge;
window.initAnnouncements = initAnnouncements;
`
  )
);

write(
  'features/styles.js',
  featureFile(
    'styles',
    `${sliceLines(app, 941, 1043)}
window.updateStyles = updateStyles;
${sliceLines(app, 1265, 1327)}
`
  )
);

write(
  'features/clicks.js',
  featureFile('clicks', sliceLines(app, 837, 906))
);

write(
  'features/auth.js',
  featureFile(
    'auth',
    `${sliceLines(app, 908, 939)}
${sliceLines(app, 1612, 1982)}
window.handleAuthError = handleAuthError;
`
  )
);

write('features/profile.js', featureFile('profile', sliceLines(app, 1331, 1608)));

write(
  'features/render.js',
  featureFile('render', sliceLines(app, 2187, 3025))
);

write('features/sidebar.js', featureFile('sidebar', sliceLines(app, 3027, 3152)));

write('features/zen.js', featureFile('zen', sliceLines(app, 3154, 3236)));

const uxLines = searchUx.split('\n');
const uxStart = uxLines.findIndex((l) => l.includes("'use strict'")) + 1;
const uxEnd = uxLines.findLastIndex((l) => l.trim() === '})();');
let searchUxBody = uxLines.slice(uxStart, uxEnd).join('\n');
searchUxBody = searchUxBody
  .replace(
    /typeof isPageManagementMode !== 'undefined' && isPageManagementMode/,
    'window.isPageManagementMode'
  )
  .replace(
    /typeof currentEnginePrefix !== 'undefined'/g,
    "typeof window.currentEnginePrefix !== 'undefined'"
  )
  .replace(
    /currentEnginePrefix = action;/,
    'window.currentEnginePrefix = action;'
  );

write(
  'features/search.js',
  featureFile(
    'search',
    `${sliceLines(app, 3238, 3510)}

export function initSearchUx() {
${searchUxBody}
}
`
  )
);

write(
  'features/misc.js',
  featureFile(
    'misc',
    `${sliceLines(app, 3638, 3975)}
window.openJsonEditor = openJsonEditor;
`
  )
);

write(
  'features/boot.js',
  featureFile(
    'boot',
    `${sliceLines(app, 444, 525)}
${sliceLines(app, 557, 571)}
${sliceLines(app, 1984, 2185)}
${sliceLines(app, 3511, 3636)}
${sliceLines(app, 3977, 4384)}
`
  )
);

// --- admin tab split ---
function um(from, to) {
  return sliceLines(userManage, from, to);
}

write(
  'features/admin/shared.js',
  `/**
 * Admin Hub shared helpers.
 */
export const utils_debounce = window.utils ? window.utils.debounce : (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

export const utils_escapeHTML = window.utils ? window.utils.escapeHTML : (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
};
`
);

write(
  'features/admin/users.js',
  `import { utils_debounce, utils_escapeHTML } from './shared.js';

${um(279, 327)}

${um(907, 1088)}

${um(1202, 1265)}

${um(1417, 1435)}

export { renderAdminUserTableHTML, performAdminUserSearch };
`
);

write(
  'features/admin/invites.js',
  `import { utils_debounce, utils_escapeHTML } from './shared.js';

${um(564, 728)}

${um(1167, 1200)}

${um(1380, 1415)}

export { renderAdminInviteTableHTML, performAdminInviteSearch };
`
);

write(
  'features/admin/announcements.js',
  `import { utils_debounce, utils_escapeHTML } from './shared.js';

${um(329, 562)}

${um(1267, 1378)}

export { renderAdminAnnounceTableHTML, performAdminAnnounceSearch };
`
);

write(
  'features/admin/audit.js',
  `import { utils_debounce, utils_escapeHTML } from './shared.js';

${um(730, 905)}

${um(1090, 1139)}

export { renderAdminAuditTableHTML, performAdminAuditSearch };
`
);

let hubSrc = `import { renderAdminUserTableHTML } from './users.js';
import { renderAdminInviteTableHTML } from './invites.js';
import { renderAdminAnnounceTableHTML } from './announcements.js';
import { renderAdminAuditTableHTML } from './audit.js';

${um(25, 277)}

${um(1141, 1165)}
`;
hubSrc = hubSrc
  .replace(/\bupdateAdminBatchBar\(\)/g, 'window.updateAdminBatchBar()')
  .replace(/\bupdateAnnounceBatchBar\(\)/g, 'window.updateAnnounceBatchBar()')
  .replace(/\bupdateInviteBatchBar\(\)/g, 'window.updateInviteBatchBar()')
  .replace(/\bupdateAuditBatchBar\(\)/g, 'window.updateAuditBatchBar()');
write('features/admin/hub.js', hubSrc);

write(
  'features/admin/index.js',
  `import './shared.js';
import './users.js';
import './invites.js';
import './announcements.js';
import './audit.js';
import './hub.js';
`
);

const pageManage = fs.readFileSync(path.join(JS, 'page-manage.js'), 'utf8');
if (!pageManage.includes('const showToast = (...args) => window.showToast')) {
  const preamble = `const showToast = (...args) => window.showToast(...args);
const closeAllModals = (...args) => window.closeAllModals(...args);
const updateStyles = (...args) => window.updateStyles(...args);
const renderNav = (...args) => window.renderNav(...args);
const renderTools = (...args) => window.renderTools(...args);
const utils = window.utils;
const Sortable = window.Sortable;

`;
  fs.writeFileSync(path.join(JS, 'page-manage.js'), preamble + pageManage);
  console.log('patched page-manage.js wrappers');
}

write(
  'main.js',
  `/**
 * CloudNav front-end entry (ES module).
 * Load order matches the former classic <script> sequence so window APIs
 * exist before DOMContentLoaded handlers run.
 */
import './utils.js';
import './colorExtractor.js';
import './emoji-pool.js';
import './theme-mode.js';
import './personalization.js';
import './cloud-sync.js';
import './sys-config.js';
import './import-export-sanitize.js';
import './features/state.js';
import './features/ui.js';
import './features/idb-bg.js';
import './features/audit-map.js';
import './features/sync-ui.js';
import './features/clicks.js';
import './features/notices.js';
import './features/styles.js';
import './features/auth.js';
import './features/profile.js';
import './features/render.js';
import './features/sidebar.js';
import './features/zen.js';
import './features/search.js';
import './features/misc.js';
import './features/boot.js';
import './page-manage.js';
import './features/admin/index.js';
import { initSearchUx } from './features/search.js';

initSearchUx();
`
);

console.log('split complete');

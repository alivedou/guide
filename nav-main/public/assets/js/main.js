/**
 * CloudNav front-end entry (ES module).
 * Load order matches the former classic <script> sequence so window APIs
 * exist before DOMContentLoaded handlers run.
 */
import './utils.js';
import './colorExtractor.js';
import './emoji-pool.js';
import './theme-mode.js';
import './bg-resolve.js';
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

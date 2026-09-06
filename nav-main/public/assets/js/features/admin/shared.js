/**
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

/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * emoji-pool.js - Emoji 图标库与随机生成逻辑
 * ==========================================
 */
const EMOJI_CATEGORIES = {
    natureAndTravel: ["🌍", "🌎", "🌏", "🌋", "🗻", "🏕️", "🏖️", "🏝️", "🏔️", "🌊", "🌲", "🌸", "🌞", "🌙", "⭐"],
    objectsAndSymbols: ["💡", "🔥", "✨", "🎈", "🎉", "💎", "🧭", "🎨", "📱", "💻", "🖥️", "电视", "📻", "📷", "🔋", "🔌", "💰", "💳", "❤️", "✅", "🌐", "🎵", "🎶", "🔗", "🔒", "🔑", "📦", "🎁"],
    officeAndBookmarks: ["📂", "📁", "📄", "📝", "📅", "📊", "📈", "📚", "📖", "🔖", "✉️", "📥", "📫", "🔨", "🛠️", "⚙️", "🔧"],
    activitiesAndSports: ["⚽", "🏀", "🏈", "⚾", "🎾", "🎱", "🎮", "🕹️", "🎰", "🎲", "🧩", "🎭", "🖼️"]
};
const ALL_EMOJIS = [...EMOJI_CATEGORIES.natureAndTravel, ...EMOJI_CATEGORIES.objectsAndSymbols, ...EMOJI_CATEGORIES.officeAndBookmarks, ...EMOJI_CATEGORIES.activitiesAndSports];
const EMOJI_KEYWORDS = {
    "办公": EMOJI_CATEGORIES.officeAndBookmarks,
    "自然": EMOJI_CATEGORIES.natureAndTravel,
    "数码": ["📱", "💻", "🖥️", "电视", "📻", "📷"],
    "金融": ["💰", "💳", "💸"],
    "生活": ["💡", "🔥", "✨", "🎈", "🎉", "🎁", "❤️", "🔑"]
};
const searchEmojisByKeyword = (q) => {
    if (!q) return [];
    q = q.toLowerCase().trim();
    for (const [k, v] of Object.entries(EMOJI_KEYWORDS)) if (k.includes(q)) return v;
    return ALL_EMOJIS.filter(e => e.includes(q));
};
const getRandomEmojis = (c = 30) => {
    const p = [...ALL_EMOJIS], r = [];
    while (r.length < Math.min(c, p.length)) r.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    return r;
};
window.emojiPool = { EMOJI_CATEGORIES, ALL_EMOJIS, getRandomEmojis, searchEmojisByKeyword };

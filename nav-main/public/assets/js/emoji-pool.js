/**
 * ==========================================
 * emoji-pool.js - Emoji 图标库与随机生成逻辑
 * 独立模块，方便后续扩展更多分类或图标
 * ==========================================
 */

// 定义分类别的 Emoji 库
const EMOJI_CATEGORIES = {
    // 自然与旅行
    natureAndTravel: [
        '🌍', '🌎', '🌏', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', 
        '🏔️', '🚂', '🚁', '🚀', '🛸', '⛵', '🚤', '🛳️', '✈️', '🛫', 
        '🛬', '🌌', '🌠', '🌤️', '⛈️', '🌈', '🌊', '🌲', '🌴', '🌵',
        '🍀', '🍁', '🍄', '🌸', '🌻', '🌺', '🍃', '🌞', '🌙', '⭐'
    ],
    // 物品与符号
    objectsAndSymbols: [
        '💡', '🔥', '✨', '🎈', '🎉', '💎', '🧭', '🔮', '🧩', '🎨', 
        '📱', '💻', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', 
        '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', 
        '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', 
        '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️',
        '🗑️', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '🪙',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '✅', '❎', '🌐', '🌀', '💤', '♨️', '🎵', '🎶', '➕', '➖'
    ],
    // 活动与体育
    activitiesAndSports: [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', 
        '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', 
        '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', 
        '⛸️', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺',
        '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '🪅', '🪩', '🎭', '🖼️'
    ]
};

/**
 * 将所有分类合并为一个扁平的数组，供随机抽取使用
 */
const ALL_EMOJIS = [
    ...EMOJI_CATEGORIES.natureAndTravel,
    ...EMOJI_CATEGORIES.objectsAndSymbols,
    ...EMOJI_CATEGORIES.activitiesAndSports
];

/**
 * 随机获取指定数量的不重复 Emoji
 * @param {number} count - 需要获取的 Emoji 数量 (默认 30)
 * @returns {string[]} - 包含随机 Emoji 字符的数组
 */
const getRandomEmojis = (count = 30) => {
    // 复制一份总池子以避免修改原数组
    const pool = [...ALL_EMOJIS];
    const result = [];
    
    // 如果请求的数量大于池子总量，则最多只返回池子总量
    const maxCount = Math.min(count, pool.length);

    for (let i = 0; i < maxCount; i++) {
        // 随机生成一个索引
        const randomIndex = Math.floor(Math.random() * pool.length);
        // 将选中的 Emoji 放入结果数组
        result.push(pool[randomIndex]);
        // 从池子中移除已选中的 Emoji，确保不重复
        pool.splice(randomIndex, 1);
    }

    return result;
};

// 将模块挂载到全局 window 对象，供 app.js 调用
window.emojiPool = {
    EMOJI_CATEGORIES,
    ALL_EMOJIS,
    getRandomEmojis
};
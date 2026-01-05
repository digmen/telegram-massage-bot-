export const ik = (rows) => ({ reply_markup: { inline_keyboard: rows } });

export const sendHTML = (bot, chatId, html, extra = {}) =>
    bot.sendMessage(chatId, html, { parse_mode: "HTML", ...extra });



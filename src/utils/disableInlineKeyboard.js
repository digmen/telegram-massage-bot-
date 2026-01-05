export async function disableInlineKeyboard(bot, query) {
    try {
        const chatId = query.message?.chat?.id;
        const messageId = query.message?.message_id;
        if (!chatId || !messageId) return;
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
    } catch { }
}
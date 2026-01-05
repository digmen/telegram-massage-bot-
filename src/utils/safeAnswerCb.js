export async function safeAnswerCb(bot, query) {
    try {
        await bot.answerCallbackQuery(query.id);
    } catch { }
}
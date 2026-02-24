import "dotenv/config";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";

import { initDb, getUser, upsertUser } from "./storage.js";
import { startReminderWorker } from "./reminders.js";

import { buildAdminLeadMessage } from "./utils/sendMessageAdmin.js";
import { QUESTIONS } from "./const/questions.js";
import { sleep } from "./utils/sleep.js";
import {
    beginMsg,
    bookMsg,
    findSolutionMsg,
    secondMsg,
    solutionMsg,
    startMsg,
    askRequestMsg,
    hasRequestYesMsg,
    hasRequestNoMsg,
} from "./const/message.js";
import { scheduleNudges } from "./utils/scheduleNudges.js";
import { SECOND_PHOTO_PATH, START_PHOTO_PATH } from "./const/media.js";
import { disableInlineKeyboard } from "./utils/disableInlineKeyboard.js";
import { ik, sendHTML } from "./utils/tg.js";
import { kbContact, removeKb } from "./utils/contact.js";
import { safeAnswerCb } from "./utils/safeAnswerCb.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID || 0);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

async function completeBooking({ tgId, chatId, phone, from, userCached }) {
    await upsertUser(tgId, {
        phone,
        bookedAt: new Date().toISOString(),
        state: "booked",
        chatId,
    });

    await bot.sendMessage(
        chatId,
        "Спасибо! ✅ Я передал заявку Роме. Он свяжется с вами лично.",
        removeKb()
    );

    const updated = await getUser(tgId);
    const adminMsg = buildAdminLeadMessage(updated || userCached, phone, { from });
    await bot.sendMessage(ADMIN_CHAT_ID, adminMsg);
}

async function submitAnswersFlow({ tgId, chatId }) {
    const user = await getUser(tgId);

    if (!user || (user.answers || []).length < QUESTIONS.length) {
        await bot.sendMessage(chatId, "Похоже, не все ответы заполнены. Давайте продолжим 🙂");
        return;
    }

    await upsertUser(tgId, {
        state: "diag_submitted",
        diagSubmittedAt: new Date().toISOString(),
        chatId,
    });

    await scheduleNudges(tgId);

    await sendHTML(
        bot,
        chatId,
        findSolutionMsg,
        ik([[{ text: "Узнать решение!", callback_data: "solution" }]])
    );
}

bot.onText(/^\/start(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const tgId = msg.from?.id;
    if (!tgId) return;

    await upsertUser(tgId, {
        firstName: msg.from?.first_name || null,
        username: msg.from?.username || null,
        state: "intro_wait",
        chatId,
    });

    await bot.sendPhoto(
        chatId,
        fs.createReadStream(START_PHOTO_PATH),
        { caption: startMsg, parse_mode: "HTML" },
        { contentType: "image/jpeg" }
    );

    await sleep(2000);

    await sendHTML(
        bot,
        chatId,
        secondMsg,
        ik([
            [{ text: "Начинаем 🤝", callback_data: "begin" }],
        ])
    );

});

bot.on("callback_query", async (query) => {
    const data = query.data;
    const chatId = query.message?.chat?.id;
    const tgId = query.from?.id;

    if (!data || !chatId || !tgId) {
        await safeAnswerCb(bot, query);
        return;
    }

    await disableInlineKeyboard(bot, query);
    await safeAnswerCb(bot, query);

    switch (data) {
        case "begin":
            await upsertUser(tgId, { state: "ready", chatId });

            await bot.sendPhoto(
                chatId,
                fs.createReadStream(SECOND_PHOTO_PATH),
                {
                    caption: beginMsg,
                    parse_mode: "HTML",
                    ...ik([[{ text: "Пройти диагностику", callback_data: "diag_start" }]]),
                },
                { contentType: "image/jpeg" }
            );

            return;
        case "diag_start":
            await upsertUser(tgId, { state: "diag_q1", answers: [], chatId });
            await sendHTML(
                bot,
                chatId,
                "✅ Начинаем диагностику:\n" +
                "(Опишите текстом или нажмите «Нет»)\n\n"
                + QUESTIONS[0],
                ik([[{ text: "Нет, не беспокоит", callback_data: "no_pain" }]])
            );
            return;
        case "send_answers":
            await submitAnswersFlow({ tgId, chatId });
            return;
        case "solution":
            await upsertUser(tgId, {
                solutionOpenedAt: new Date().toISOString(),
                state: "solution",
                chatId,
            });

            await sendHTML(
                bot,
                chatId,
                solutionMsg,
                ik([[{ text: "💆‍♂️Записаться на пробный массаж", callback_data: "book" }]])
            );
            return;
        case "no_pain":
            await upsertUser(tgId, { state: "ask_request", chatId });
            await sendHTML(
                bot,
                chatId,
                askRequestMsg,
                ik([
                    [{ text: "Да", callback_data: "has_request_yes" }],
                    [{ text: "Нет", callback_data: "has_request_no" }],
                ])
            );
            return;
        case "has_request_yes":
            await upsertUser(tgId, { state: "need_phone", chatId });
            await sendHTML(bot, chatId, hasRequestYesMsg, kbContact());
            return;
        case "has_request_no":
            await upsertUser(tgId, { state: "need_phone", chatId });
            await sendHTML(bot, chatId, hasRequestNoMsg, kbContact());
            return;
        case "book":
            await upsertUser(tgId, { state: "need_phone", chatId });

            await sendHTML(bot, chatId, bookMsg, kbContact());
            return;
        default:
            await bot.sendMessage(chatId, "Не понял команду 🙂 Нажмите /start");
            return;
    }
});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const tgId = msg.from?.id;
    if (!tgId) return;

    if (typeof msg.text === "string" && msg.text.startsWith("/start")) return;

    const user = await getUser(tgId);
    if (!user) return;

    if (msg.contact) {
        if (msg.contact.user_id && msg.contact.user_id !== tgId) {
            await bot.sendMessage(chatId, "Пожалуйста, отправьте свой контакт кнопкой ниже 🙂");
            return;
        }

        await completeBooking({
            tgId,
            chatId,
            phone: msg.contact.phone_number,
            from: msg.from,
            userCached: user,
        });
        return;
    }

    if (typeof msg.text === "string") {
        const text = msg.text.trim();

        if (user.state === "need_phone") {
            const phoneRegex = /^[\d\s\-+().]{7,20}$/;
            if (!phoneRegex.test(text)) {
                await bot.sendMessage(chatId, "Пожалуйста, отправьте корректный номер телефона 📞", kbContact());
                return;
            }
            await completeBooking({
                tgId,
                chatId,
                phone: text,
                from: msg.from,
                userCached: user,
            });
            return;
        }

        if (user.state?.startsWith("diag_q")) {
            const idx = Number(user.state.replace("diag_q", "")) - 1;
            const answers = Array.isArray(user.answers) ? [...user.answers] : [];
            answers[idx] = text;

            const nextIdx = idx + 1;

            if (nextIdx < QUESTIONS.length) {
                await upsertUser(tgId, { answers, state: `diag_q${nextIdx + 1}`, chatId });
                await sendHTML(
                    bot,
                    chatId,
                    QUESTIONS[nextIdx]
                );
            } else {
                await upsertUser(tgId, { answers, state: "diag_ready_to_send", chatId });

                await submitAnswersFlow({ tgId, chatId });
            }
            return;
        }

        await bot.sendMessage(
            chatId,
            "Чтобы начать — нажмите /start 🙂\n\nЕсли хотите записаться — нажмите кнопку ниже.",
            ik([[{ text: "💆‍♂️Записаться", callback_data: "book" }]])
        );
    }
});

bot.on("polling_error", (err) => console.error("Polling error:", err.message));

process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    bot.stopPolling();
    process.exit(0);
});

process.on("SIGTERM", () => {
    bot.stopPolling();
    process.exit(0);
});

(async () => {
    await initDb();
    startReminderWorker(bot);

    console.log("✅ Bot is running (polling)...");
})();

import cron from "node-cron";
import { listDueReminders, markReminderSent, getUser } from "./storage.js";

export function startReminderWorker(bot) {
    cron.schedule("* * * * *", async () => {
        const nowIso = new Date().toISOString();
        const due = await listDueReminders(nowIso);

        for (const r of due) {
            const user = await getUser(r.tgId);

            if (!user || user.bookedAt) {
                await markReminderSent(r.id);
                continue;
            }

            try {
                if (r.type === "nudge_24h") {
                    await bot.sendMessage(
                        r.tgId,
                        "Если хотите прийти на пробный сеанс— нажмите на кнопку ниже, далее Я свяжусь с Вами лично!",
                        {
                            reply_markup: {
                                inline_keyboard: [[
                                    {
                                        text: "Хочу на сеанс!", callback_data: "book"
                                    }
                                ]]
                            }
                        }
                    );
                }

                if (r.type === "nudge_48h") {
                    await bot.sendMessage(
                        r.tgId,
                        "Напоминаю: проблема сама себя не решит, если Вы ей не поможете 👇",
                        {
                            reply_markup: {
                                inline_keyboard: [[
                                    {
                                        text: "Сделать запись.", callback_data: "book"
                                    }
                                ]]
                            }
                        }
                    );
                }
                await markReminderSent(r.id);
            } catch { }
        }
    });
}

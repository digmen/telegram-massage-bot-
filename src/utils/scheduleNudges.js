import { addReminder } from "../storage.js";

export async function scheduleNudges(tgId) {
    const now = Date.now();
    const idBase = `${tgId}_${now}`;

    await addReminder({
        id: `${idBase}_24`,
        tgId,
        type: "nudge_24h",
        dueAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        sentAt: null
    });

    await addReminder({
        id: `${idBase}_48`,
        tgId,
        type: "nudge_48h",
        dueAt: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
        sentAt: null
    });
}
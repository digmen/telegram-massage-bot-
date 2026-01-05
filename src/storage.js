import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "..", "data");
const dbFile = path.join(dataDir, "db.json");

function ensureDbFile() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify({ users: [], reminders: [] }, null, 2), "utf-8");
        return;
    }

    const raw = fs.readFileSync(dbFile, "utf-8").trim();

    if (!raw) {
        fs.writeFileSync(dbFile, JSON.stringify({ users: [], reminders: [] }, null, 2), "utf-8");
        return;
    }

    try {
        JSON.parse(raw);
    } catch {
        const backup = path.join(dataDir, `db.broken.${Date.now()}.json`);
        fs.writeFileSync(backup, raw, "utf-8");
        fs.writeFileSync(dbFile, JSON.stringify({ users: [], reminders: [] }, null, 2), "utf-8");
        console.warn(`⚠️ db.json был битый. Бэкап: ${backup}`);
    }
}

ensureDbFile();

const adapter = new JSONFile(dbFile);
export const db = new Low(adapter, { users: [], reminders: [] });

export async function initDb() {
    await db.read();
    db.data ||= { users: [], reminders: [] };
    db.data.users ||= [];
    db.data.reminders ||= [];
    await db.write();
}

export async function getUser(tgId) {
    await db.read();
    return db.data.users.find((u) => u.tgId === tgId) || null;
}

export async function upsertUser(tgId, patch) {
    await db.read();
    let u = db.data.users.find((x) => x.tgId === tgId);

    if (!u) {
        u = {
            tgId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            state: "idle",
            answers: [],
            diagSubmittedAt: null,
            solutionOpenedAt: null,
            bookedAt: null,
            phone: null,
            firstName: null,
            username: null
        };
        db.data.users.push(u);
    }

    Object.assign(u, patch, { updatedAt: new Date().toISOString() });
    await db.write();
    return u;
}

export async function addReminder(reminder) {
    await db.read();
    db.data.reminders.push(reminder);
    await db.write();
}

export async function listDueReminders(nowIso) {
    await db.read();
    return db.data.reminders.filter((r) => !r.sentAt && r.dueAt <= nowIso);
}

export async function markReminderSent(id) {
    await db.read();
    const r = db.data.reminders.find((x) => x.id === id);
    if (r) r.sentAt = new Date().toISOString();
    await db.write();
}

export function buildAdminLeadMessage(user, phone, ctx) {
    const name = (user.firstName || ctx.from.first_name || "").trim();
    const uname = user.username ? `@${user.username}` : "";
    const displayName = [name, uname].filter(Boolean).join(" / ");

    const { request, urgency } = buildLeadSummary(user);

    return (
        "🆕 Новый клиент в воронке!\n" +
        `Имя: ${displayName}\n` +
        `Телефон: ${phone}\n` +
        "Запрос:\n" +
        `${request}\n` +
        `Срочность: ${urgency}`
    );
}

function buildLeadSummary(user) {
    const a = user.answers || [];
    const get = (i) => (a[i] ?? "").toString().trim();

    const request =
        `Боль: ${get(0)}\n` +
        `Область: ${get(1)}\n` +
        `Давно: ${get(2)}\n` +
        `Влияние на жизнь: ${get(3)}\n` +
        `Пробовал решения: ${get(4)}`;

    const urgency = get(5);

    return { request, urgency };
}
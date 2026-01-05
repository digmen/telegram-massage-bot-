export function kbContact() {
    return {
        reply_markup: {
            keyboard: [[{ text: "📱 Отправить телефон", request_contact: true }]],
            one_time_keyboard: true,
            resize_keyboard: true,
        },
    };
}

export function removeKb() {
    return { reply_markup: { remove_keyboard: true } };
}
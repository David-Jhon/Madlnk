const { getAiringSchedule } = require("../utilities/anilistUtils");

const ITEMS_PER_PAGE = 25;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayOffset(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date;
}

function getUnixTimestamps(offsetDays) {
    const date = getDayOffset(offsetDays);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    return {
        start: Math.floor(startOfDay.getTime() / 1000),
        end: Math.floor(endOfDay.getTime() / 1000),
        date: startOfDay
    };
}

function formatCountdown(seconds) {
    if (seconds < 0) return "Aired";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    let timeStr = '';
    if (days > 0) timeStr += `${days}d `;
    if (hours > 0) timeStr += `${hours}h `;
    if (minutes > 0 || (days === 0 && hours === 0)) timeStr += `${minutes}m`;

    return `in ${timeStr.trim()}`;
}

function formatScheduleCaption(schedules, date, offsetDays) {
    const dayName = DAY_NAMES[date.getDay()];
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let caption = `📅 *Airing Schedule - ${dayName}, ${dateStr}*\n\n`;

    if (!schedules || schedules.length === 0) {
        caption += "*No anime airing on this day.*";
        return caption;
    }

    const now = Math.floor(Date.now() / 1000);

    schedules.forEach((schedule) => {
        const title = schedule.media.title.english || schedule.media.title.romaji;
        const episode = schedule.episode;
        const airingTime = new Date(schedule.airingAt * 1000);
        const timeStr = airingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const countdown = formatCountdown(schedule.airingAt - now);

        caption += `⚬ \`${title}\` - \`Ep ${episode}\` | \`${timeStr} UTC (${countdown})\`\n`;
    });

    caption += `\n*Total: ${schedules.length} Anime Airing*`;

    return caption;
}

function buildDayKeyboard(currentOffset) {
    const buttons = [];

    const dayRow = [];
    for (let i = -1; i <= 1; i++) {
        const offset = currentOffset + i;
        const date = getDayOffset(offset);
        const dayName = DAY_NAMES[date.getDay()];
        const label = i === 0 ? `•${dayName}•` : dayName;

        dayRow.push({
            text: label,
            callback_data: `schedule:day:${offset}`
        });
    }

    buttons.push(dayRow);

    const navRow = [];
    navRow.push({
        text: "⬅️ Back",
        callback_data: `schedule:nav:${currentOffset - 3}`
    });
    navRow.push({
        text: "Next ➡️",
        callback_data: `schedule:nav:${currentOffset + 3}`
    });

    buttons.push(navRow);

    return { inline_keyboard: buttons };
}

module.exports = {
    name: "schedule",
    version: 1.0,
    longDescription: "View anime airing schedule with interactive day navigation. Shows anime titles, episode numbers, airing times (UTC), and countdowns.",
    shortDescription: "View anime airing schedule",
    guide: "{pn}",
    category: ['Anime & Manga Information', 4],
    lang: {
        error: "An error occurred while fetching the airing schedule. Please try again.",
    },

    onStart: async ({ bot, msg }) => {
        const chatId = msg.chat.id;

        try {
            const { start, end, date } = getUnixTimestamps(0);
            const scheduleData = await getAiringSchedule(start, end, 1, ITEMS_PER_PAGE);

            const caption = formatScheduleCaption(scheduleData.airingSchedules, date, 0);
            const keyboard = buildDayKeyboard(0);

            return bot.sendMessage(chatId, caption, {
                parse_mode: "Markdown",
                reply_markup: keyboard
            });

        } catch (error) {
            console.error("Error in /schedule command:", error);
            return bot.sendMessage(chatId, module.exports.lang.error);
        }
    },

    onCallback: async ({ bot, callbackQuery }) => {
        const chatId = callbackQuery.message?.chat?.id;
        const messageId = callbackQuery.message?.message_id;

        if (!chatId || !messageId) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Error: Invalid callback" });
        }

        const data = callbackQuery.data.split(':');
        const action = data[1];
        const offset = parseInt(data[2]);

        try {
            const { start, end, date } = getUnixTimestamps(offset);
            const scheduleData = await getAiringSchedule(start, end, 1, ITEMS_PER_PAGE);

            const caption = formatScheduleCaption(scheduleData.airingSchedules, date, offset);
            const keyboard = buildDayKeyboard(offset);

            await bot.editMessageText(caption, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
                reply_markup: keyboard
            });

            await bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error("Error in schedule callback:", error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: "An error occurred. Please try again.",
                show_alert: true
            });
        }
    }
};

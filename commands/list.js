const axios = require("axios");

module.exports = function (bot, callbackListeners) {
    bot.onText(/\/list/, async (msg) => {
        const chatId = msg.chat.id;
        const keyboard = [
            [{ text: "Manga", callback_data: "list_manga_0_init" }],
            [{ text: "Manhwa", callback_data: "list_manhwa_0_init" }],
            [{ text: "Manhua", callback_data: "list_manhua_0_init" }],
            [{ text: "Anime", callback_data: "list_anime_0_init" }]
        ];

        const replyMarkup = { inline_keyboard: keyboard };
        bot.sendMessage(chatId, "Please select a category to see the list of available titles\n\n\n[NOTE: Each category is updated regularly with the latest titles]", { reply_markup: replyMarkup });
    });

    // Register the callback query handler for list operations
    callbackListeners.set('list_', async (callbackQuery) => {
        const data = callbackQuery.data;
        const [_, action, pageString, initial] = data.split('_');
        const currentPage = parseInt(pageString, 10);
        const chatId = callbackQuery.message.chat.id;
        let url, category;

        switch (action) {
            case "manga":
                url = "https://api.telegra.ph/getPage/List-of-Manga-Part-1-07-18?return_content=true";
                category = "Manga";
                break;
            case "manhwa":
                url = "https://api.telegra.ph/getPage/List-of-Manhwa-07-18?return_content=true";
                category = "Manhwa";
                break;
            case "manhua":
                url = "https://api.telegra.ph/getPage/List-of-Manhua-07-25?return_content=true";
                category = "Manhua";
                break;
            case "anime":
                url = "https://api.telegra.ph/getPage/List-of-Anime-Part-1-10-23?return_content=true";
                category = "Anime";
                break;
            default:
                return;
        }

        try {
            const data = await fetchData(url);
            if (!data || data.length === 0) {
                await bot.sendMessage(chatId, "No data found for the selected category.");
                return;
            }

            const itemsPerPage = 20;
            const list = await fetchAnimeData(data);
            const paginatedList = list.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
            const numPages = Math.ceil(list.length / itemsPerPage);

            let keyboard = [];

            if (numPages > 1) {
                keyboard.push([
                    ...(currentPage > 0 ? [{ text: "⬅️ Previous", callback_data: `list_${action}_${currentPage - 1}` }] : []),
                    ...(currentPage < numPages - 1 ? [{ text: "Next ➡️", callback_data: `list_${action}_${currentPage + 1}` }] : [])
                ]);
            }

            const replyMarkup = { inline_keyboard: keyboard };

            const messageText = `❏ *Here is the list of ${category}*\n\n${paginatedList.join("\n")}`;

            if (initial === 'init') {
                await bot.sendMessage(chatId, messageText, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: replyMarkup
                });
            } else {
                await bot.editMessageText(messageText, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: replyMarkup
                });
            }
        } catch (error) {
            console.error("Error processing callback query:", error);
            await bot.sendMessage(chatId, "Failed to fetch data.");
        }
    });
}

async function fetchData(url) {
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Non-200 status code:', response.status);
            return null;
        }
    } catch (error) {
        console.error("Error fetching data from API:", error);
        return null;
    }
}

async function fetchAnimeData(data) {
    const content = data['result']['content'];
    const list = [];
    let itemNumber = 1;
    for (const item of content) {
        if (typeof item === 'object') {
            const children = item.children || [];
            for (const child of children) {
                if (child instanceof Object && child['tag'] === 'a') {
                    const text = child.children[0] || '';
                    const href = child.attrs.href || '';
                    list.push(`*${itemNumber}.* [${text}](${href})`);
                    itemNumber++;
                }
            }
        }
    }
    return list;
}

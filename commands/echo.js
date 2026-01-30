module.exports = {
    name: "echo",
    version: 1.0,
    category: ['Admin', 99],
    longDescription: '',
    shortDescription: 'Echo',
    guide: "Usage: {pn} <your message>",

    onStart: async ({ bot, msg }) => {
        const chatId = msg.chat.id;
        const echoText = msg.text.replace('/echo', '').trim();

        if (!echoText) {
            await bot.sendMessage(chatId, module.exports.guide, { 
                parse_mode: 'Markdown', 
                disable_web_page_preview: true 
            });
            return;
        }

        await bot.sendMessage(chatId, echoText, { 
            parse_mode: 'Markdown', 
            disable_web_page_preview: true 
        });
    }
};

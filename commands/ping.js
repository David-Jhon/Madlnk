module.exports = {
    name: 'ping',
    version: 1.0,
    longDescription: '',
    shortDescription: 'Check the bot’s ping.',
    guide: '{pn}',
    category: ['Admin', 99],

    onStart: async ({ bot, msg, args }) => {
        const chatId = msg.chat.id;
        const start = Date.now();

        bot.sendMessage(chatId, '🏓 Pinging...').then(sent => {
            const end = Date.now();
            const ping = end - start;

            bot.editMessageText(`🎉 _MADBot Pong!!!_\n\`Ping: ${ping} ms\``, {
                chat_id: sent.chat.id,
                message_id: sent.message_id,
                parse_mode: 'Markdown'
            });
        })
    }
}
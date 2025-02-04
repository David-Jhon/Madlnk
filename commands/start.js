module.exports = {
    name: 'start',
    version: 1.0,
    longDescription: '',
    shortDescription: 'Get started with Bot',
    guide: '{pn}',
    category: ['Getting Started', 1],

    onStart: async ({ bot, msg, args }) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `Hey there! \`${msg.from.first_name}\` 😃 \n\n𝗜'𝗺 𝗮 𝗠𝗔𝗗 𝗯𝗼𝘁. I can help you find anime, manga, manhwa, manhua. \nTo see the list of all commands, type /help.`, { parse_mode: 'Markdown'});
    }
  };
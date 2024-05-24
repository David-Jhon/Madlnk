///Start command

module.exports = function (bot) {
  bot.on('message', (msg) => {
      if (msg.text === '/start') {
            bot.sendMessage(msg.chat.id, `Hey there! \`${msg.from.first_name}\` 😃 \n\n𝗜'𝗺 𝗮 𝗠𝗔𝗗 𝗯𝗼𝘁. I can help you find anime, manga, manhwa, manhua. \nTo see the list of all commands, type /help.`, { parse_mode: 'Markdown'});
    }
  });
};
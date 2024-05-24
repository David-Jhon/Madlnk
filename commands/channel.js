/////Manga Command
module.exports = function (bot) {
  bot.on('message', (message) => {
    if (message.text === "/manga") {
      bot.sendMessage(message.chat.id, '*Manga, Manhwa, Manhua Channel*:\n\nDiscover a world of manga, manhwa, and manhua by joining our channel.\n\n[Manga Manhwa Manhua Download](https://t.me/mangadwnld)\n\n',{ parse_mode: 'Markdown'});
    }
  });
  /////Anime Command
  bot.on('message', (message) => {
    if (message.text === '/anime') {
      bot.sendMessage(message.chat.id, '*Anime Channel*:\n\nDiscover a world of Anime by joining our channel.\n\n[Anime Drive 2.0](https://t.me/animedrive2)\n\n*You can download anime*',{ parse_mode: 'Markdown'});
    }
  });
}

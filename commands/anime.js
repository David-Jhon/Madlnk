module.exports = {
    name: "anime",
    version: 1.0,
    longDescription: '',
    shortDescription: 'Get anime channel',
    guide: "{pn}",
    category: ['Anime & Manga Channels', 2],
    onStart: async ({ bot, msg, args }) => {
      const chatId = msg.chat.id;
      if (args.length > 0) return;
      await bot.sendMessage(
        chatId,
        "*Anime Channel*:\n\nDiscover a world of Anime by joining our channel.\n\n[Anime Drive 2.0](https://t.me/animedrive2)\n\n*You can download anime*",
        { parse_mode: "Markdown" }
      );
    },
  };
module.exports = {
    name: "manga",
    version: 1.0,
    longDescription: '',
    shortDescription: 'Get manga channel',
    guide: "{pn}",
    category: ['Anime & Manga Channels', 2],
    onStart: async ({ bot, msg }) => {
      await bot.sendMessage(
        msg.chat.id,
        "*Manga, Manhwa, Manhua Channel*:\n\nDiscover a world of manga, manhwa, and manhua by joining our channel.\n\n[Manga Manhwa Manhua Download](https://t.me/mangadwnld)\n\n",
        { parse_mode: "Markdown" }
      );
    },
  };
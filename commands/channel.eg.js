module.exports = {
  name: "channel",
  aliases: ["anime", "manga"],
  version: 1.0,
  description: "Provides links to manga and anime channels.",
  guide: "Send '/manga' or '/anime' to get relevant channel links.",
  category: 'Anime & Manga Channels',
  onStart: async ({ bot, msg, commandUsed }) => {
    const responses = {
      anime: "*Anime Channel*:\n\n[Anime Drive 2.0](https://t.me/animedrive2)\n\n*You can download anime*",
      manga: "*Manga Channel*:\n\n[Manga Manhwa Manhua Download](https://t.me/mangadwnld)",
      channel: "Please specify a valid command: /anime or /manga"
    };

    const response = responses[commandUsed] || responses.channel;
    await bot.sendMessage(msg.chat.id, response, { parse_mode: "Markdown" });
  }
};
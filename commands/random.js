const { getRandomMedia } = require('../utilities/anilistUtils');

module.exports = {
  name: "random",
  version: 1.0,
  longDescription: "Get a random anime and start watching it",
  shortDescription: "Get a random anime",
  guide: "{pn}",
  category: ['Anime & Manga Information', 3],
  lang: {
    error: "Sorry, there was an error fetching the anime information."
  },
  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    try {
      const anime = await getRandomMedia('ANIME');

      const title = anime.title.romaji || "N/A";
      const englishTitle = anime.title.english || "N/A";
      const nativeTitle = anime.title.native || "N/A";
      const genres = anime.genres.join(", ") || "N/A";
      const episodes = anime.episodes || "Airing";
      const format = anime.format;
      const startDate = `${anime.startDate.day}-${anime.startDate.month}-${anime.startDate.year}`;
      const season = anime.season;
      const seasonYear = anime.seasonYear;
      const status = anime.status;
      const averageScore = anime.averageScore;
      const tags = anime.tags.slice(0, 5).map(tag => tag.name).join(", ") || "N/A";
      const coverImageUrl = `https://img.anili.st/media/${anime.id}`;
      const moreInfoUrl = `https://anilist.co/anime/${anime.id}`;

      let relations = "";
      anime.relations.edges.forEach(edge => {
        if (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL") {
          relations += `*${edge.relationType}:* \`${edge.node.title.romaji}\`\n`;
        }
      });

      const caption = `*➤ Title:* • \`${title}\`\n• \`${englishTitle}\`\n• \`${nativeTitle}\`\n*➤ Type:* ${format}\n*➤ Start Date:* ${startDate}\n*➤ Season:* ${season}, ${seasonYear}\n*➤ Episodes:* ${episodes}\n*➤ Status:* ${status}\n*➤ Score:* ${averageScore}\n*➤ Genres:* ${genres}\n*➤ Tags:* ${tags}\n${relations ? "*➤ Relations:*\n" + relations : ""}`;

      await bot.sendPhoto(chatId, coverImageUrl, {
        caption,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "More info", url: moreInfoUrl }]]
        }
      });
    } catch (error) {
      bot.sendMessage(chatId, module.exports.lang.error);
    }
  },
  onCallback: null
};

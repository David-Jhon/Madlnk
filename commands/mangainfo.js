const axios = require("axios");

const ANILIST_URL = "https://graphql.anilist.co/";

const MANGA_INFO_QUERY = `
  query ($title: String) {
    Media (search: $title, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      description
      genres
      format
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      chapters
      volumes
      status
      averageScore
      tags {
        name
      }
      countryOfOrigin
    }
  }
`;

module.exports = {
  name: "mangainfo",
  version: 1.0,
  longDescription:
    "View detailed manga information including titles, description, genres, chapters, volumes, status, and more from AniList.",
  shortDescription: "Get detailed information about a manga",
  guide: "{pn} <manga title>",
  category: ['Anime & Manga Information', 3],
  lang: {
    noTitle:
      "Please provide a manga title to search for.\nFormat: /mangainfo <manga name>\nExample: /mangainfo naruto",
    notFound: (title) => `No manga found with the title: ${title}`,
    error:
      "An error occurred while fetching manga information. Try using the romanized name or a proper title.",
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const mangaTitle = args.join(" ").trim();

    if (!mangaTitle) {
      return bot.sendMessage(chatId, module.exports.lang.noTitle);
    }

    try {
      const variables = { title: mangaTitle };
      const response = await axios.post(ANILIST_URL, {
        query: MANGA_INFO_QUERY,
        variables,
      });
      const mangaData = response.data.data.Media;

      if (!mangaData) {
        return bot.sendMessage(chatId, module.exports.lang.notFound(mangaTitle));
      }

      const { romaji, english, native } = mangaData.title;
      let title = "";
      if (english) {
        title += `\`${english}\`\n`;
      }
      if (romaji) {
        title += `• \`${romaji}\`\n`;
      }
      if (native) {
        title += `• \`${native}\`\n`;
      }

      const description =
        (mangaData.description || "").replace(/<[^>]+>/g, " ").substring(0, 900) +
        "...";

      const genres = mangaData.genres.join(", ");
      const tags = (mangaData.tags || [])
        .slice(0, 5)
        .map((tag) => tag.name)
        .join(", ");
      const format = mangaData.format;
      const startDate = `${mangaData.startDate.day}-${mangaData.startDate.month}-${mangaData.startDate.year}`;
      const endDate = mangaData.endDate
        ? `${mangaData.endDate.day}-${mangaData.endDate.month}-${mangaData.endDate.year}`
        : "N/A";
      const chapters = mangaData.chapters || "N/A";
      const volumes = mangaData.volumes || "N/A";
      const status = mangaData.status;
      const averageScore = mangaData.averageScore;
      const countryOfOrigin = mangaData.countryOfOrigin;
      const id = mangaData.id;

      const coverImage = `https://img.anili.st/media/${id}`;

      await bot.sendPhoto(chatId, coverImage);

      const message = `❏ *Title:*\n${title}
*➤ Type:* ${format}
*➤ Genres:* ${genres}
*➤ Tags:* ${tags}
*➤ Start Date:* ${startDate}
*➤ End Date:* ${endDate}
*➤ Chapters:* ${chapters}
*➤ Volumes:* ${volumes}
*➤ Status:* ${status}
*➤ Country:* ${countryOfOrigin}
*➤ Score:* ${averageScore}
*➤ Description:*\n${description}`;

      await bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "More Info",
                url: `https://anilist.co/manga/${id}`,
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error("Error in /mangainfo command:", error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },
  onCallback: null,
};

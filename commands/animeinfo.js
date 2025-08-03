const axios = require("axios");

const ANILIST_URL = "https://graphql.anilist.co/";

const ANIME_INFO_QUERY = `
  query ($title: String) {
    Media (search: $title, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      description
      coverImage {
        medium
        large
      }
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
      season
      seasonYear
      episodes
      status
      averageScore
      tags {
        name
      }
      relations {
        edges {
          relationType(version: 2)
          node {
            id
            title {
              romaji
              english
            }
          }
        }
      }
    }
  }
`;

module.exports = {
  name: "animeinfo",
  version: 1.0,
  longDescription:
    "View detailed anime information including titles, description, genres, episodes, season, status, and more from AniList.",
  shortDescription: "Get detailed information about an anime",
  guide: "{pn} <anime title>",
  category: ['Anime & Manga Information', 3],
  lang: {
    noTitle:
      "Please provide an anime title to search for.\nFormat: /animeinfo <anime name>\nExample: /animeinfo one punch man",
    notFound: (title) => `No anime found with the title: ${title}`,
    error:
      "An error occurred while fetching anime information. Try the romanized name or a proper title.",
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const animeTitle = args.join(" ").trim();

    if (!animeTitle) {
      return bot.sendMessage(chatId, module.exports.lang.noTitle);
    }

    try {
      const variables = { title: animeTitle };
      const response = await axios.post(ANILIST_URL, {
        query: ANIME_INFO_QUERY,
        variables,
      });
      const animeData = response.data.data.Media;

      if (!animeData) {
        return bot.sendMessage(chatId, module.exports.lang.notFound(animeTitle));
      }

      const { romaji, english, native } = animeData.title;
      let titleText = "";
      if (english) {
        titleText += `\`${english}\`\n`;
      }
      if (romaji) {
        titleText += `• \`${romaji}\`\n`;
      }
      if (native) {
        titleText += `• \`${native}\`\n`;
      }

      const description =
        (animeData.description || "").replace(/<[^>]+>/g, " ").substring(0, 900) +
        "...";

      const genres = animeData.genres.join(", ");
      const tags = (animeData.tags || [])
        .slice(0, 5)
        .map((tag) => tag.name)
        .join(", ");
      const format = animeData.format;
      const startDate = `${animeData.startDate.day}-${animeData.startDate.month}-${animeData.startDate.year}`;
      const endDate = animeData.endDate
        ? `${animeData.endDate.day}-${animeData.endDate.month}-${animeData.endDate.year}`
        : "Still Airing";
      const season = animeData.season;
      const seasonYear = animeData.seasonYear;
      const episodes = animeData.episodes || "N/A";
      const status = animeData.status;
      const averageScore = animeData.averageScore;
      const id = animeData.id;
      const coverImage = `https://img.anili.st/media/${id}`;

      let relations = "";
      if (animeData.relations && animeData.relations.edges) {
        animeData.relations.edges.forEach((edge) => {
          if (
            edge.relationType === "PREQUEL" ||
            edge.relationType === "SEQUEL"
          ) {
            relations += `*${edge.relationType}:* \`${edge.node.title.english || edge.node.title.romaji}\`\n`;
          }
        });
      }

      await bot.sendPhoto(chatId, coverImage);
      const message = `❏ *Title:*\n${titleText}
*➤ Type:* \`${format}\`
*➤ Genres:* \`${genres}\`
*➤ Tags:* \`${tags}\`
*➤ Start Date:* \`${startDate}\`
*➤ End Date:* \`${endDate}\`
*➤ Season:* \`${season}, ${seasonYear}\`
*➤ Episodes:* \`${episodes}\`
*➤ Status:* \`${status}\`
*➤ Score:* \`${averageScore}\`
${relations ? `\n*➤ Relations:*\n${relations}` : ""}
*➤ Description:*\n\`${description}\``;

      return bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "More Info",
                url: `https://anilist.co/anime/${id}`,
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error(error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },
  onCallback: null,
};

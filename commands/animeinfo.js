const { getMediaList, getMediaById, getMediaCharacters } = require("../utilities/anilistUtils");

const SEARCH_RESULTS_LIMIT = 5;
const CHARACTERS_PER_PAGE = 25;
const DESCRIPTION_MAX_LENGTH = 1000;
const BUTTON_TITLE_MAX_LENGTH = 60;
const TOP_TAGS_COUNT = 5;
const RECOMMENDATIONS_COUNT = 15;

function truncate(text, maxLength) {
  if (!text) return "";
  text = text.replace(/<[^>]+>/g, " ").trim();
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function truncateTitle(title, maxLength = BUTTON_TITLE_MAX_LENGTH) {
  if (!title) return "Unknown";
  return title.length > maxLength ? title.substring(0, maxLength) + "..." : title;
}

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return num + "st";
  if (j === 2 && k !== 12) return num + "nd";
  if (j === 3 && k !== 13) return num + "rd";
  return num + "th";
}

function formatAiringSchedule(nextAiring) {
  if (!nextAiring) return null;

  const seconds = nextAiring.timeUntilAiring;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let timeStr = '';
  if (days > 0) timeStr += `${days} Day${days > 1 ? 's' : ''}, `;
  if (hours > 0) timeStr += `${hours} Hour${hours > 1 ? 's' : ''}, `;
  if (minutes > 0) timeStr += `${minutes} Minute${minutes > 1 ? 's' : ''}, `;
  if (secs > 0 && days === 0) timeStr += `${secs} Second${secs > 1 ? 's' : ''}`;

  timeStr = timeStr.replace(/, $/, '');
  return `➤ *NEXT AIRING:* \`${timeStr} | ${getOrdinalSuffix(nextAiring.episode)} eps\``;
}

function formatTrailer(trailer) {
  if (!trailer || !trailer.site) return null;

  let url = '';
  if (trailer.site === 'youtube') {
    url = `https://youtu.be/${trailer.id}`;
  } else if (trailer.site === 'dailymotion') {
    url = `https://www.dailymotion.com/video/${trailer.id}`;
  }

  return url ? `🎬 [Trailer](${url})` : null;
}

function formatMainCaption(anime) {
  const { romaji, english, native } = anime.title;
  let titleText = "";
  if (english) titleText += `\`${english}\`\n`;
  if (romaji && romaji !== english) titleText += `• \`${romaji}\`\n`;
  if (native) titleText += `• \`${native}\`\n`;

  const genres = anime.genres.join(", ");
  const tags = (anime.tags || [])
    .slice(0, TOP_TAGS_COUNT)
    .map((tag) => tag.name)
    .join(", ");
  const format = anime.format || "N/A";

  const startDate = anime.startDate?.year
    ? `${anime.startDate.day || '?'}-${anime.startDate.month || '?'}-${anime.startDate.year}`
    : "N/A";
  const endDate = anime.endDate?.year
    ? `${anime.endDate.day || '?'}-${anime.endDate.month || '?'}-${anime.endDate.year}`
    : "Ongoing";

  const season = anime.season ? `${anime.season}, ${anime.seasonYear}` : "N/A";
  const episodes = anime.episodes || "N/A";
  const status = anime.status;
  const averageScore = anime.averageScore || "N/A";


  let relations = "";
  if (anime.relations?.edges) {
    anime.relations.edges.forEach((edge) => {
      if (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL") {
        relations += `*${edge.relationType}:* \`${edge.node.title.english || edge.node.title.romaji}\`\n`;
      }
    });
  }

  let caption = `❏ *Title:*\n${titleText}`;
  caption += `*➤ Type:* \`${format}\`\n`;
  caption += `*➤ Genres:* \`${genres}\`\n`;
  if (tags) caption += `*➤ Tags:* \`${tags}\`\n`;
  caption += `*➤ Start Date:* \`${startDate}\`\n`;
  caption += `*➤ End Date:* \`${endDate}\`\n`;
  caption += `*➤ Season:* \`${season}\`\n`;
  caption += `*➤ Episodes:* \`${episodes}\`\n`;
  caption += `*➤ Status:* \`${status}\`\n`;
  caption += `*➤ Score:* \`${averageScore}\`\n`;

  const airingSchedule = formatAiringSchedule(anime.nextAiringEpisode);
  if (airingSchedule) caption += `${airingSchedule}\n`;

  if (relations) caption += `\n*➤ Relations:*\n${relations}`;

  const trailer = formatTrailer(anime.trailer);
  if (trailer) caption += `\n${trailer}\n`;

  return caption;
}

function formatDescription(anime) {
  const description = truncate(anime.description, DESCRIPTION_MAX_LENGTH);
  return `*Description:*\n\n\`${description}\``;
}

function formatRecommendations(anime) {
  const recs = anime.recommendations?.edges || [];

  if (recs.length === 0) {
    return "*No recommendations found.*";
  }

  let text = "*Recommendations:*\n\n";
  recs.slice(0, RECOMMENDATIONS_COUNT).forEach((edge) => {
    const title = edge.node.mediaRecommendation?.title.english ||
      edge.node.mediaRecommendation?.title.romaji ||
      "Unknown";
    text += `⚬ \`${title}\`\n`;
  });

  return text;
}

function buildMainKeyboard(animeId) {
  return {
    inline_keyboard: [
      [
        { text: "Description", callback_data: `animeinfo:desc:${animeId}` },
        { text: "Characters", callback_data: `animeinfo:chars:${animeId}:0` },
        { text: "Recommendations", callback_data: `animeinfo:recs:${animeId}` }
      ],
      [
        { text: "More Info", url: `https://anilist.co/anime/${animeId}` }
      ]
    ]
  };
}

function buildDescriptionKeyboard(animeId) {
  return {
    inline_keyboard: [
      [{ text: "Back", callback_data: `animeinfo:main:${animeId}` }],
      [{ text: "More Info", url: `https://anilist.co/anime/${animeId}` }]
    ]
  };
}


function buildCharactersKeyboard(animeId, page, hasNext, hasPrev) {
  const buttons = [];
  const navRow = [];

  if (hasPrev) {
    navRow.push({ text: "Previous", callback_data: `animeinfo:chars:${animeId}:${page - 1}` });
  }
  navRow.push({ text: "Back", callback_data: `animeinfo:main:${animeId}` });
  if (hasNext) {
    navRow.push({ text: "Next", callback_data: `animeinfo:chars:${animeId}:${page + 1}` });
  }

  buttons.push(navRow);
  buttons.push([{ text: "More Info", url: `https://anilist.co/anime/${animeId}` }]);

  return { inline_keyboard: buttons };
}


function buildRecommendationsKeyboard(animeId) {
  return {
    inline_keyboard: [
      [{ text: "Back", callback_data: `animeinfo:main:${animeId}` }],
      [{ text: "More Info", url: `https://anilist.co/anime/${animeId}` }]
    ]
  };
}


function buildSearchResultsKeyboard(results) {
  const buttons = results.map((anime, index) => {
    const title = truncateTitle(anime.title.romaji || anime.title.english);
    return [{ text: `${index + 1}. ${title}`, callback_data: `animeinfo:select:${anime.id}` }];
  });

  return { inline_keyboard: buttons };
}

module.exports = {
  name: "animeinfo",
  version: 2.0,
  longDescription:
    "Search and view detailed anime information with interactive navigation for description, characters, and recommendations.",
  shortDescription: "Get detailed anime information",
  guide: "{pn} <anime title>",
  category: ['Anime & Manga Information', 3],
  lang: {
    noTitle: "Please provide an anime title to search for.\nFormat: /animeinfo <anime name>\nExample: /animeinfo one piece",
    notFound: (title) => `No anime found with the title: ${title}`,
    error: "An error occurred while fetching anime information. Please try again.",
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const animeTitle = args.join(" ").trim();

    if (!animeTitle) {
      return bot.sendMessage(chatId, module.exports.lang.noTitle);
    }

    try {
      const results = await getMediaList({
        type: 'ANIME',
        search: animeTitle,
        perPage: SEARCH_RESULTS_LIMIT,
        page: 1
      });

      if (!results.media || results.media.length === 0) {
        return bot.sendMessage(chatId, module.exports.lang.notFound(animeTitle));
      }

      if (results.media.length === 1) {
        const anime = results.media[0];
        const coverImage = `https://img.anili.st/media/${anime.id}`;
        const caption = formatMainCaption(anime);
        const keyboard = buildMainKeyboard(anime.id);

        return bot.sendPhoto(chatId, coverImage, {
          caption,
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
      }

      const keyboard = buildSearchResultsKeyboard(results.media);
      return bot.sendMessage(chatId, `Found results for \`${animeTitle}\`. Please select:`, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

    } catch (error) {
      console.error("Error in /animeinfo command:", error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },

  onCallback: async ({ bot, callbackQuery }) => {
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
    const messageId = callbackQuery.message?.message_id;

    if (!chatId) {
      console.error("No chat ID found in callback query");
      return bot.answerCallbackQuery(callbackQuery.id, { text: "Error: Invalid callback" });
    }

    const data = callbackQuery.data.split(':');

    const action = data[1];
    const animeId = parseInt(data[2]);
    const page = data[3] ? parseInt(data[3]) : 0;

    try {
      const anime = await getMediaById(animeId);

      if (!anime) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Anime not found!" });
      }

      const coverImage = `https://img.anili.st/media/${anime.id}`;

      switch (action) {
        case 'select':
        case 'main': {
          const caption = formatMainCaption(anime);
          const keyboard = buildMainKeyboard(anime.id);

          if (!messageId) {
            await bot.sendPhoto(chatId, coverImage, {
              caption,
              parse_mode: "Markdown",
              reply_markup: keyboard
            });
          } else {
            await bot.editMessageMedia({
              type: 'photo',
              media: coverImage,
              caption,
              parse_mode: "Markdown"
            }, {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: keyboard
            });
          }
          break;
        }

        case 'desc': {
          const caption = formatDescription(anime);
          const keyboard = buildDescriptionKeyboard(anime.id);

          await bot.editMessageCaption(caption, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
          break;
        }

        case 'chars': {
          const charactersData = await getMediaCharacters(animeId, page + 1, CHARACTERS_PER_PAGE);

          if (!charactersData || !charactersData.edges || charactersData.edges.length === 0) {
            await bot.editMessageCaption("*No characters found.*", {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: buildCharactersKeyboard(animeId, page, false, false)
            });
            break;
          }

          let text = "*Characters:*\n\n";
          charactersData.edges.forEach((edge) => {
            const name = edge.node.name.full || edge.node.name.native || "Unknown";
            const role = edge.role || "UNKNOWN";
            text += `⚬ \`${name}\` (${role})\n`;
          });

          text += `\nTotal Characters: ${charactersData.pageInfo.total}`;

          const hasNext = charactersData.pageInfo.hasNextPage;
          const hasPrev = page > 0;
          const keyboard = buildCharactersKeyboard(animeId, page, hasNext, hasPrev);

          await bot.editMessageCaption(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
          break;
        }

        case 'recs': {
          const caption = formatRecommendations(anime);
          const keyboard = buildRecommendationsKeyboard(anime.id);

          await bot.editMessageCaption(caption, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
          break;
        }
      }

      await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error("Error in animeinfo callback:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "An error occurred. Please try again.",
        show_alert: true
      });
    }
  }
};

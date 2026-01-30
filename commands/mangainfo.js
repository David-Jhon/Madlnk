const { getMediaList, getMediaById, getMediaRelations } = require("../utilities/anilistUtils");

const SEARCH_RESULTS_LIMIT = 5;
const RELATIONS_PER_PAGE = 12;
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

function escapeMarkdown(text) {
  if (!text) return "";
  return text.replace(/[`_*[\]()~>#+=|{}.!-]/g, '\\$&');
}

function formatMainCaption(manga) {
  const { romaji, english, native } = manga.title;
  let titleText = "";
  if (english) titleText += `\`${english}\`\n`;
  if (romaji && romaji !== english) titleText += `• \`${romaji}\`\n`;
  if (native) titleText += `• \`${native}\`\n`;

  const genres = manga.genres.join(", ");
  const tags = (manga.tags || [])
    .slice(0, TOP_TAGS_COUNT)
    .map((tag) => tag.name)
    .join(", ");
  const format = manga.format || "N/A";

  const startDate = manga.startDate?.year
    ? `${manga.startDate.day || '?'}-${manga.startDate.month || '?'}-${manga.startDate.year}`
    : "N/A";
  const endDate = manga.endDate?.year
    ? `${manga.endDate.day || '?'}-${manga.endDate.month || '?'}-${manga.endDate.year}`
    : "Ongoing";

  const chapters = manga.chapters || "N/A";
  const volumes = manga.volumes || "N/A";
  const status = manga.status;
  const averageScore = manga.averageScore || "N/A";
  const country = manga.countryOfOrigin || "N/A";

  let caption = `❏ *Title:*\n${titleText}`;
  caption += `*➤ Type:* \`${format}\`\n`;
  caption += `*➤ Genres:* \`${genres}\`\n`;
  if (tags) caption += `*➤ Tags:* \`${tags}\`\n`;
  caption += `*➤ Start Date:* \`${startDate}\`\n`;
  caption += `*➤ End Date:* \`${endDate}\`\n`;
  caption += `*➤ Chapters:* \`${chapters}\`\n`;
  caption += `*➤ Volumes:* \`${volumes}\`\n`;
  caption += `*➤ Status:* \`${status}\`\n`;
  caption += `*➤ Country:* \`${country}\`\n`;
  caption += `*➤ Score:* \`${averageScore}\`\n`;

  return caption;
}

function formatDescription(manga) {
  const description = truncate(manga.description, DESCRIPTION_MAX_LENGTH);
  return `*Description:*\n\n\`${description}\``;
}

function formatRecommendations(manga) {
  const recs = manga.recommendations?.edges || [];

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

function buildMainKeyboard(mangaId) {
  return {
    inline_keyboard: [
      [
        { text: "Description", callback_data: `mangainfo:desc:${mangaId}` },
        { text: "Relations", callback_data: `mangainfo:rels:${mangaId}:0` },
        { text: "Recommendations", callback_data: `mangainfo:recs:${mangaId}` }
      ],
      [
        { text: "More Info", url: `https://anilist.co/manga/${mangaId}` }
      ]
    ]
  };
}

function buildDescriptionKeyboard(mangaId) {
  return {
    inline_keyboard: [
      [
        { text: "Back", callback_data: `mangainfo:main:${mangaId}` },
        { text: "More Info", url: `https://anilist.co/manga/${mangaId}` }
      ]
    ]
  };
}

function buildRelationsKeyboard(mangaId, page, hasNext, hasPrev) {
  const buttons = [];
  const navRow = [];

  if (hasPrev) {
    navRow.push({ text: "Previous", callback_data: `mangainfo:rels:${mangaId}:${page - 1}` });
  }
  navRow.push({ text: "Back", callback_data: `mangainfo:main:${mangaId}` });
  if (hasNext) {
    navRow.push({ text: "Next", callback_data: `mangainfo:rels:${mangaId}:${page + 1}` });
  }

  buttons.push(navRow);
  buttons.push([{ text: "More Info", url: `https://anilist.co/manga/${mangaId}` }]);

  return { inline_keyboard: buttons };
}

function buildRecommendationsKeyboard(mangaId) {
  return {
    inline_keyboard: [
      [
        { text: "Back", callback_data: `mangainfo:main:${mangaId}` },
        { text: "More Info", url: `https://anilist.co/manga/${mangaId}` }
      ]
    ]
  };
}

function buildSearchResultsKeyboard(results) {
  const buttons = results.map((manga, index) => {
    const title = truncateTitle(manga.title.romaji || manga.title.english);
    return [{ text: `${index + 1}. ${title}`, callback_data: `mangainfo:select:${manga.id}` }];
  });
  return { inline_keyboard: buttons };
}

module.exports = {
  name: "mangainfo",
  version: 2.0,
  longDescription: "View detailed manga information including titles, description, genres, chapters, volumes, status, and more from AniList.",
  shortDescription: "Get detailed information about a manga",
  guide: "{pn} <manga title>",
  category: ['Anime & Manga Information', 3],
  lang: {
    noTitle: "Please provide a manga title to search for.\nFormat: /mangainfo <manga name>\nExample: /mangainfo naruto",
    notFound: (title) => `No manga found with the title: ${title}`,
    error: "An error occurred while fetching manga information. Please try again.",
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const mangaTitle = args.join(" ").trim();

    if (!mangaTitle) {
      return bot.sendMessage(chatId, module.exports.lang.noTitle);
    }

    try {
      const results = await getMediaList({
        type: 'MANGA',
        search: mangaTitle,
        perPage: SEARCH_RESULTS_LIMIT,
        page: 1
      });

      if (!results.media || results.media.length === 0) {
        return bot.sendMessage(chatId, module.exports.lang.notFound(mangaTitle));
      }

      if (results.media.length === 1) {
        const manga = results.media[0];
        const coverImage = `https://img.anili.st/media/${manga.id}`;
        const caption = formatMainCaption(manga);
        const keyboard = buildMainKeyboard(manga.id);

        return bot.sendPhoto(chatId, coverImage, {
          caption,
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
      }

      const keyboard = buildSearchResultsKeyboard(results.media);
      return bot.sendMessage(chatId, `Found results for \`${mangaTitle}\`. Please select:`, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

    } catch (error) {
      console.error("Error in /mangainfo command:", error);
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
    const mangaId = parseInt(data[2]);
    const page = data[3] ? parseInt(data[3]) : 0;

    try {
      const manga = await getMediaById(mangaId);

      if (!manga) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Manga not found!" });
      }

      const coverImage = `https://img.anili.st/media/${manga.id}`;

      switch (action) {
        case 'select':
        case 'main': {
          const caption = formatMainCaption(manga);
          const keyboard = buildMainKeyboard(manga.id);

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
          const caption = formatDescription(manga);
          const keyboard = buildDescriptionKeyboard(manga.id);

          await bot.editMessageCaption(caption, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
          break;
        }

        case 'rels': {
          const relationsData = await getMediaRelations(mangaId);

          if (!relationsData || !relationsData.edges || relationsData.edges.length === 0) {
            await bot.editMessageCaption("*No relations found.*", {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: buildRelationsKeyboard(mangaId, page, false, false)
            });
            break;
          }

          const allRelations = relationsData.edges;
          const start = page * RELATIONS_PER_PAGE;
          const end = start + RELATIONS_PER_PAGE;
          const pageRelations = allRelations.slice(start, end);

          let text = "*Relations:*\n\n";
          pageRelations.forEach((edge) => {
            const title = (edge.node.title.english || edge.node.title.romaji || "Unknown").replace(/`/g, '\\`');
            const type = edge.node.type || "UNKNOWN";
            const relationType = escapeMarkdown(edge.relationType || "UNKNOWN");
            text += `⚬ \`${title}\` - (${type}) ${relationType}\n`;
          });

          text += `\nTotal Relations: ${allRelations.length}`;

          const hasNext = end < allRelations.length;
          const hasPrev = page > 0;
          const keyboard = buildRelationsKeyboard(mangaId, page, hasNext, hasPrev);

          await bot.editMessageCaption(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
          break;
        }

        case 'recs': {
          const caption = formatRecommendations(manga);
          const keyboard = buildRecommendationsKeyboard(manga.id);

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
      console.error("Error in mangainfo callback:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "An error occurred. Please try again.",
        show_alert: true
      });
    }
  }
};
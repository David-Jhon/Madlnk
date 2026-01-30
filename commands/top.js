const { getMediaList } = require('../utilities/anilistUtils');

function buildFilterDescription(genre, year) {
  if (genre && year) {
    return ` for genre ${genre.toUpperCase()} from ${year}`;
  } else if (genre) {
    return ` for genre ${genre.toUpperCase()}`;
  } else if (year) {
    return ` from ${year}`;
  }
  return '';
}

function buildPaginationKeyboard(type, genre, year, page, hasNextPage) {
  const inlineKeyboard = [];
  const row = [];

  if (page > 1) {
    row.push({
      text: 'Previous',
      callback_data: `top:${type}:${genre || 'none'}:${year || 'none'}:${page - 1}`
    });
  }

  if (hasNextPage) {
    row.push({
      text: 'Next',
      callback_data: `top:${type}:${genre || 'none'}:${year || 'none'}:${page + 1}`
    });
  }

  if (row.length) inlineKeyboard.push(row);
  return inlineKeyboard;
}

async function fetchTopMedia(type, genre, year, page) {
  const options = {
    type: type.toUpperCase(),
    sort: 'SCORE_DESC',
    genre: genre,
    page: page,
    perPage: 15
  };

  if (year) {
    // Use startDate filtering for year, works for both Anime and Manga
    // Format is YYYYMMDD
    options.startDateGreater = (year - 1) * 10000 + 1231; // e.g. 20241231
    options.startDateLesser = (year + 1) * 10000 + 101;   // e.g. 20260101
  }

  const result = await getMediaList(options);

  if (!result.media || !result.media.length) {
    return null;
  }

  const titles = result.media
    .map(media => `⚬ \`${media.title.romaji}\``)
    .join('\n');

  const filterDesc = buildFilterDescription(genre, year);
  const messageText = `❏ *Top ${type.toUpperCase()}${filterDesc}:*\n\n${titles}\n\nTotal available ${type.toLowerCase()}: ${result.pageInfo.total}`;

  return {
    messageText,
    hasNextPage: result.pageInfo.hasNextPage
  };
}

module.exports = {
  name: 'top',
  version: 1.0,
  longDescription:
    "Display top anime or manga titles with optional genre and year filters.",
  shortDescription: "Retrieve top anime or manga titles",
  guide: "{pn} <anime | manga> [[genre]] [[year]]" +
    "\n\n─── Examples:" +
    "\n\n📺 /top anime - View the top anime titles\n" +
    "📚 /top manga - Explore the top manga titles\n" +
    "🔍 /top anime action - Top anime in the action genre\n" +
    "📅 /top anime 2024 - Top anime from 2024\n" +
    "🎯 /top anime action 2024 - Top action anime from 2024\n" +
    "🎯 /top manga comedy 2023 - Top comedy manga from 2023",
  category: ['Anime & Manga Information', 3],
  lang: {
    syntaxError: "The command you are using is wrong syntax, please type /help top to see the details of how to use this command",
    usage: "Usage: /top anime|manga [genre] [year]",
    error: "An error occurred while fetching data.",
    notFound: "No media found."
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    if (!args || args.length === 0) {
      return bot.sendMessage(chatId, module.exports.lang.syntaxError);
    }

    const typeArg = args[0].toLowerCase();
    if (typeArg !== 'anime' && typeArg !== 'manga') {
      return bot.sendMessage(chatId, module.exports.lang.usage);
    }

    // Parse genre and year from arguments
    let genre = null;
    let year = null;

    if (args[1]) {
      const firstArg = args[1];
      if (/^\d{4}$/.test(firstArg)) {
        year = parseInt(firstArg);
      } else {
        genre = firstArg;
      }
    }

    if (args[2]) {
      const secondArg = args[2];
      if (/^\d{4}$/.test(secondArg)) {
        year = parseInt(secondArg);
      } else if (!genre) {
        genre = secondArg;
      }
    }

    const page = 1;

    try {
      const result = await fetchTopMedia(typeArg, genre, year, page);

      if (!result) {
        return bot.sendMessage(chatId, module.exports.lang.notFound);
      }

      const keyboard = buildPaginationKeyboard(typeArg, genre, year, page, result.hasNextPage);

      return bot.sendMessage(chatId, result.messageText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error(error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },


  onCallback: async ({ bot, callbackQuery, params }) => {
    const message = callbackQuery.message;
    if (!params || params.length < 4) {
      return bot.answerCallbackQuery(callbackQuery.id);
    }

    let [type, genreParam, yearParam, pageStr] = params;
    const page = parseInt(pageStr, 10);
    const genre = genreParam === 'none' ? null : genreParam;
    const year = yearParam === 'none' ? null : parseInt(yearParam);

    try {
      const result = await fetchTopMedia(type, genre, year, page);

      if (!result) {
        bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.notFound });
        return;
      }

      const keyboard = buildPaginationKeyboard(type, genre, year, page, result.hasNextPage);

      await bot.editMessageText(result.messageText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      return bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error(error);
      return bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.error });
    }
  }
};

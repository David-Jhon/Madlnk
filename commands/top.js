const axios = require('axios');

const TOP_QUERY = `
query ($gnr: String, $page: Int, $type: MediaType) {
  Page (perPage: 15, page: $page) {
    pageInfo {
      lastPage
      total
      hasNextPage
    }
    media (genre: $gnr, sort: SCORE_DESC, type: $type) {
      title {
        romaji
      }
    }
  }
}
`;


async function fetchTopMediaPage(page, type, genre) {
  try {
    const response = await axios({
      url: 'https://graphql.anilist.co',
      method: 'post',
      data: {
        query: TOP_QUERY,
        variables: {
          page: page,
          type: type,
          gnr: genre
        }
      }
    });
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching top ${type.toLowerCase()} page:`, error);
    throw error;
  }
}


module.exports = {
  name: 'top',
  version: 1.0,
  longDescription:
    "Display top anime or manga titles with an optional genre filter.",
  shortDescription: "Retrieve top anime or manga titles",
  guide: "{pn} <anime | manga> | [[genre]]"+
  "\n\n─── Example:"+
  "\n\n📺 /top anime - View the top anime titles\n" +
  "📚 /top manga - Explore the top manga titles\n\n" +
  "You can also specify a genre:\n\n" +
  "🔍 /top anime action - Discover top anime titles in the action genre\n" +
  "🔍 /top manga comedy - Explore top manga titles in the comedy genre",
  category: ['Anime & Manga Information', 3],
  lang: {
    syntaxError: "The command you are using is wrong syntax, please type %1help %2 to see the details of how to use this command",
    usage: "Usage: /top anime|manga [genre]",
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
    const type = typeArg.toUpperCase(); 
    const genre = args[1] ? args[1] : null;
    const page = 1;

    try {
      const data = await fetchTopMediaPage(page, type, genre);
      if (!data.Page || !data.Page.media.length) {
        return bot.sendMessage(chatId, module.exports.lang.notFound);
      }
      const titles = data.Page.media
        .map(media => `⚬ \`${media.title.romaji}\``)
        .join('\n');
      const totalMedia = data.Page.pageInfo.total;
      const hasNextPage = data.Page.pageInfo.hasNextPage;

      const inlineKeyboard = [];
      const row = [];
      if (page > 1) {
        row.push({
          text: 'Previous',
          callback_data: `top:${typeArg}:${genre ? genre : 'none'}:${page - 1}`
        });
      }
      if (hasNextPage) {
        row.push({
          text: 'Next',
          callback_data: `top:${typeArg}:${genre ? genre : 'none'}:${page + 1}`
        });
      }
      if (row.length) inlineKeyboard.push(row);

      const messageText = `❏ *Top ${type}${genre ? ' for genre ' + genre.toUpperCase() : ''}:*\n\n${titles}\n\nTotal available ${type.toLowerCase()}: ${totalMedia}`;

      return bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    } catch (error) {
      console.error(error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },

  
  onCallback: async ({ bot, callbackQuery, params }) => {
    const message = callbackQuery.message;
    if (!params || params.length < 3) {
      return bot.answerCallbackQuery(callbackQuery.id);
    }
    let [type, genre, pageStr] = params;
    const page = parseInt(pageStr, 10);
    if (genre === 'none') genre = null;
    const typeUpper = type.toUpperCase();

    try {
      const data = await fetchTopMediaPage(page, typeUpper, genre);
      if (!data.Page || !data.Page.media.length) {
        bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.notFound });
        return;
      }
      const titles = data.Page.media
        .map(media => `⚬ \`${media.title.romaji}\``)
        .join('\n');
      const totalMedia = data.Page.pageInfo.total;
      const hasNextPage = data.Page.pageInfo.hasNextPage;

      const inlineKeyboard = [];
      const row = [];
      if (page > 1) {
        row.push({
          text: 'Previous',
          callback_data: `top:${type}:${genre ? genre : 'none'}:${page - 1}`
        });
      }
      if (hasNextPage) {
        row.push({
          text: 'Next',
          callback_data: `top:${type}:${genre ? genre : 'none'}:${page + 1}`
        });
      }
      if (row.length) inlineKeyboard.push(row);

      const messageText = `❏ *Top ${typeUpper}${genre ? ' for genre ' + genre.toUpperCase() : ''}:*\n\n${titles}\n\nTotal available ${type.toLowerCase()}: ${totalMedia}`;

      await bot.editMessageText(messageText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
      return bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error(error);
      return bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.error });
    }
  }
};

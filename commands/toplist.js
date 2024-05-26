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

module.exports = function (bot) {
  bot.onText(/\/top/, (msg) => {
    const message = "Please select the type of media you'd like to explore:\n\n" +
      "📺 /top anime - View the top anime titles\n" +
      "📚 /top manga - Explore the top manga titles\n\n" +
      "You can also specify a genre:\n\n" +
      "🔍 /top anime action - Discover top anime titles in the action genre\n" +
      "🔍 /top manga comedy - Explore top manga titles in the comedy genre";
    if (msg.text === '/top') {
      bot.sendMessage(msg.chat.id, message);
    }
  });

  bot.onText(/\/top (anime|manga)(?: (\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const type = match[1].toUpperCase();
    const genre = match[2] ? match[2] : null;

    try {
      const page = 1; // Start with page 1
      const data = await fetchTopMediaPage(page, type, genre);
      const titles = data.Page.media.map(media => `⚬ \`${media.title.romaji}\``).join('\n');
      const totalMedia = data.Page.pageInfo.total;
      const hasNextPage = data.Page.pageInfo.hasNextPage;
      const hasPreviousPage = page > 1;

      const inlineKeyboard = [];
      if (hasPreviousPage) {
        inlineKeyboard.push([{ text: 'Previous', callback_data: `top_${type.toLowerCase()}_page_${page - 1}` }]);
      }
      if (hasNextPage) {
        inlineKeyboard.push([{ text: 'Next', callback_data: `top_${type.toLowerCase()}_page_${page + 1}` }]);
      }

      const message = await bot.sendMessage(chatId, `❏ *Top ${type.toUpperCase()}${genre ? ' for genre ' + genre.toUpperCase() + ':' : ':'}*\n\n${titles}\n\nTotal available ${type.toLowerCase()}: ${totalMedia}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });

      const messageId = message.message_id;

      // Remove previous event listeners
      bot.removeAllListeners('callback_query');

      bot.on('callback_query', (callbackQuery) => {
        const data = callbackQuery.data;
        if (data.startsWith(`top_${type.toLowerCase()}_page_`)) {
          const newPage = parseInt(data.split('_')[3]);
          editTopMediaPage(chatId, messageId, newPage, type, genre);
        }
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, `Error: ${error.message}`);
    }
  });

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

  async function editTopMediaPage(chatId, messageId, page, type, genre) {
    try {
      const data = await fetchTopMediaPage(page, type, genre);
      const titles = data.Page.media.map(media => `⚬ \`${media.title.romaji}\``).join('\n');
      const totalMedia = data.Page.pageInfo.total;
      const hasNextPage = data.Page.pageInfo.hasNextPage;
      const hasPreviousPage = page > 1;

      const inlineKeyboard = [];
      if (hasPreviousPage) {
        inlineKeyboard.push([{ text: 'Previous', callback_data: `top_${type.toLowerCase()}_page_${page - 1}` }]);
      }
      if (hasNextPage) {
        inlineKeyboard.push([{ text: 'Next', callback_data: `top_${type.toLowerCase()}_page_${page + 1}` }]);
      }

      await bot.editMessageText(`❏ *Top ${type.toUpperCase()}${genre ? ' for genre ' + genre.toUpperCase() + ':' : ':'}*\n\n${titles}\n\nTotal available ${type.toLowerCase()}: ${totalMedia}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
    } catch (error) {
      console.error(`Error editing top ${type.toLowerCase()} page:`, error);
    }
  }
};

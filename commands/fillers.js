const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const FILLERS = {};

module.exports = {
  name: 'fillers',
  version: 1.0,
  longDescription: "Find anime filler episodes with categorized breakdowns of canon and filler episodes",
  shortDescription: "Search for anime fillers",
  guide: '{pn} <anime name>',
  category: ['Anime & Manga Information', 3],
  lang: {
    syntaxError: "The command you are using is wrong syntax, please type %1help %2 to see the details of how to use this command",
    usage: "Usage: /fillers<anime_name>\n\nExample: /fillers one piece",
    noResults: "No fillers found for the given anime. Make sure to use the correct title",
    error: "An error occurred while retrieving filler information."
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    
    if (!args || args.length === 0) {
      return bot.sendMessage(chatId, module.exports.lang.usage);
    }

    const query = args.join(' ').trim();

    try {
      const results = await searchFiller(query);
      if (Object.keys(results).length === 0) {
        return bot.sendMessage(chatId, module.exports.lang.noResults);
      }

      const buttons = Object.keys(results).map((title) => {
        const fillerKey = generateUniqueKey(title, msg.from.id);
        FILLERS[fillerKey] = { id: results[title], title };
        return [{ 
          text: title, 
          callback_data: `fillers:select:${fillerKey}` 
        }];
      });

      return bot.sendMessage(chatId, "🔍 Select the anime from the list:", {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      console.error(error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },

  onCallback: async ({ bot, callbackQuery, params }) => {
    const [action, fillerKey] = params;
    const message = callbackQuery.message;
    
    if (action !== 'select' || !FILLERS[fillerKey]) {
      return bot.answerCallbackQuery(callbackQuery.id, { text: "Invalid request" });
    }

    try {
      const { id: fillerId, title: animeName } = FILLERS[fillerKey];
      const result = await parseFiller(fillerId);
      
      const messageText = formatFillerMessage(animeName, result);
      
      await bot.editMessageText(messageText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] }
      });
      
      return bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error(error);
      return bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.error });
    }
  }
};

function generateUniqueKey(animeName, userId) {
  return crypto.createHash('md5')
    .update(`${animeName}_${userId}`)
    .digest('hex');
}

function formatFillerMessage(animeName, result) {
  return `*${animeName} Filler Guide* 📺\n\n` +
    `📗 *Manga Canon Episodes:*\n${result.total_ep || 'None'}\n\n` +
    `🎨 *Mixed Episodes:*\n${result.mixed_ep || 'None'}\n\n` +
    `🍿 *Filler Episodes:*\n${result.filler_ep || 'None'}\n\n` +
    `📺 *Anime Canon Episodes:*\n${result.ac_ep || 'None'}`;
}

async function searchFiller(query) {
  const response = await axios.get("https://www.animefillerlist.com/shows");
  const $ = cheerio.load(response.data);
  const index = {};

  $('.Group li').each((i, element) => {
    const href = $(element).find('a').attr('href').split('/').pop();
    const text = $(element).text().trim();
    index[text] = href;
  });

  return Object.entries(index).reduce((acc, [title, href]) => {
    if (title.toLowerCase().includes(query.toLowerCase())) {
      acc[title] = href;
    }
    return acc;
  }, {});
}

async function parseFiller(fillerId) {
  const response = await axios.get(`https://www.animefillerlist.com/shows/${fillerId}`);
  const $ = cheerio.load(response.data);
  const result = {
    total_ep: "",
    mixed_ep: "",
    filler_ep: "",
    ac_ep: ""
  };

  $('#Condensed .Episodes').each((i, section) => {
    const episodes = $(section).find('a').map((i, el) => $(el).text()).get().join(', ');
    switch(i) {
      case 0: result.total_ep = episodes; break;
      case 1: result.mixed_ep = episodes; break;
      case 2: result.filler_ep = episodes; break;
      case 3: result.ac_ep = episodes; break;
    }
  });

  return result;
}
const axios = require('axios');
const cheerio = require('cheerio');

const FILLERS = {};

function searchFiller(query) {
  return axios.get("https://www.animefillerlist.com/shows")
    .then(response => {
      const $ = cheerio.load(response.data);
      const index = {};
      $('.Group li').each((i, element) => {
        const href = $(element).find('a').attr('href').split('/').pop();
        const text = $(element).text().trim();
        index[text] = href;
      });
      const results = {};
      Object.keys(index).forEach(key => {
        if (key.toLowerCase().includes(query.toLowerCase())) {
          results[key] = index[key];
        }
      });
      return results;
    });
}

function parseFiller(fillerId) {
  const url = `https://www.animefillerlist.com/shows/${fillerId}`;
  return axios.get(url)
    .then(response => {
      const $ = cheerio.load(response.data);
      const result = {
        filler_id: fillerId,
        total_ep: "",
        mixed_ep: "",
        filler_ep: "",
        ac_ep: ""
      };

      const allEp = $('#Condensed .Episodes');

      if (allEp.length > 0) {
        result.total_ep = $(allEp[0]).find('a').map((i, el) => $(el).text()).get().join(", ");
      }
      if (allEp.length > 1) {
        result.mixed_ep = $(allEp[1]).find('a').map((i, el) => $(el).text()).get().join(", ");
      }
      if (allEp.length > 2) {
        result.filler_ep = $(allEp[2]).find('a').map((i, el) => $(el).text()).get().join(", ");
      }
      if (allEp.length > 3) {
        result.ac_ep = $(allEp[3]).find('a').map((i, el) => $(el).text()).get().join(", ");
      }
      return result;
    });
}

module.exports = (bot, callbackListeners) => {
  bot.onText(/\/fillers$/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Give some anime name to search fillers for\nexample: /fillers one piece");
  });

  bot.onText(/\/fillers (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1].trim();
    try {
      const results = await searchFiller(query);

      if (Object.keys(results).length === 0) {
        bot.sendMessage(chatId, "No fillers found for the given anime");
        return;
      }

      const buttons = Object.keys(results).map((title) => {
        const fillerKey = `${title}_${msg.from.id}`;
        FILLERS[fillerKey] = results[title];
        return [{ text: title, callback_data: `fill_${fillerKey}` }];
      });

      bot.sendMessage(chatId, "Pick the anime you want to see fillers list for:", {
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while searching for fillers.");
    }
  });

  // Register the callback query handler for fillers
  callbackListeners.set('fill_', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const match = data.match(/fill_(.+)/);

    if (!match) {
      return;
    }

    const fillerKey = match[1];
    const fillerId = FILLERS[fillerKey];
    const animeName = fillerKey.split('_')[0];

    if (!fillerId) {
      bot.answerCallbackQuery(callbackQuery.id, { text: "No data found." });
      return;
    }

    try {
      const result = await parseFiller(fillerId);
      let messageText = `*Fillers for anime* \`${animeName}\`\n\n`;
      messageText += `*Manga Canon episodes:*\n${result.total_ep || 'None'}\n\n`;
      messageText += `*Mixed Canon/Filler Episodes:*\n${result.mixed_ep || 'None'}\n\n`;
      messageText += `*Fillers:*\n${result.filler_ep || 'None'}\n\n`;
      if (result.ac_ep) {
        messageText += `*Anime Canon episodes:*\n${result.ac_ep || 'None'}\n\n`;
      }

      bot.editMessageText(messageText, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error(error);
      bot.answerCallbackQuery(callbackQuery.id, { text: "An error occurred while retrieving fillers." });
    }
  });
};


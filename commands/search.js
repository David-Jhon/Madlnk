const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'search',
  version: 1.4,
  longDescription: 'Performs a DuckDuckGo search for text results.',
  shortDescription: 'Search the web for text.',
  guide: '{pn} <query>',
  category: ['Other Utilities', 6],
  lang: {
    usage: 'Usage: /search <query>',
    error: 'Oops! Something broke while searching. Try again later? 😅',
    noQuery: 'Hey, I need a search query! Try: /search <query> 🔍',
    noResults: 'No results found for that query. Maybe try something else? 🤔',
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    if (!args || args.length === 0) {
      return bot.sendMessage(chatId, module.exports.lang.noQuery, { parse_mode: 'Markdown' });
    }

    const query = args.join(' ');

    try {
      const textResults = await searchDuckDuckGoText(query);
      let responseMessage = `<b>SEARCH RESULTS FOR "${query.toUpperCase()}" (VIA DUCKDUCKGO):</b> 🔍\n\n`;

      if (textResults.length > 0) {
        responseMessage += `<b>TEXT RESULTS:</b>\n`;
        textResults.slice(0, 6).forEach((result) => {
          responseMessage += `<blockquote><b><a href="${result.link}">${result.title.toUpperCase()}</a></b></blockquote>\n${result.snippet}\n\n`;
        });
      } else {
        responseMessage += `<b>Text Results:</b>\nNo results found. 😕\n`;
      }

      await bot.sendMessage(chatId, responseMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (error) {
      console.error('Error in search:', error);
      await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: 'Markdown' });
    }
  },
};

async function searchDuckDuckGoText(query) {
  const textUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(textUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0.0.0' },
    });
    const $ = cheerio.load(response.data);
    const textResults = [];

    $('.result__body').each((_, el) => {
      const title = $(el).find('.result__title a').text().trim();
      let link = $(el).find('.result__title a').attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();

      if (title && link) {
        if (link.startsWith('//duckduckgo.com/l/?uddg=')) {
          const decoded = decodeURIComponent(link.replace('//duckduckgo.com/l/?uddg=', ''));
          link = decoded.split('&rut=')[0];
        }
        
        if (link.includes('/y.js?') || link.includes('ad_domain=')) {
          return; // skip ad links
        }

        textResults.push({ title, link, snippet });
      }
    });

    return textResults;
  } catch (error) {
    console.error('DuckDuckGo text scraping error:', error.message);
    return [];
  }
}

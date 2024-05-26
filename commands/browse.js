const axios = require('axios');

const ANILIST_URL = 'https://graphql.anilist.co/';

async function fetchAnimeList(type, sort, year, season, page = 1, perPage = 20) {
  const query = `
    query ($type: MediaType, $sort: [MediaSort], $year: Int, $season: MediaSeason, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
        }
        media(type: $type, sort: $sort, season: $season, seasonYear: $year) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            medium
          }
          startDate {
            year
            month
            day
          }
          popularity
        }
      }
    }
  `;

  const variables = {
    type,
    sort,
    year,
    season,
    page,
    perPage,
  };

  try {
    const response = await axios.post(ANILIST_URL, { query, variables });
    return response.data.data.Page.media;
  } catch (error) {
    console.error('Error fetching anime list:', error);
    return [];
  }
}

function generateKeyboard(currentSelection) {
  return {
    inline_keyboard: [
      [
        { text: currentSelection === 'browse_trending' ? '• Trending •' : 'Trending', callback_data: 'browse_trending' },
        { text: currentSelection === 'browse_popular' ? '• Popular •' : 'Popular', callback_data: 'browse_popular' },
        { text: currentSelection === 'browse_upcoming' ? '• Upcoming •' : 'Upcoming', callback_data: 'browse_upcoming' }
      ]
    ]
  };
}

module.exports = function (bot, callbackListeners) {
  bot.onText(/\/browse/, async (msg) => {
    const chatId = msg.chat.id;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const currentSeason = seasons[Math.floor((currentMonth - 1) / 3)];

    const trending = await fetchAnimeList('ANIME', ['TRENDING_DESC'], currentYear, currentSeason);
    const responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n` +
      trending.slice(0, 20).map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``).join('\n');

    const opts = {
      reply_markup: generateKeyboard('browse_trending'),
      parse_mode: 'Markdown'
    };

    bot.sendMessage(chatId, responseText, opts)
  });

  callbackListeners.set('browse_', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (!data.startsWith('browse_')) return;  // Ensure this callback query is for browse

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const currentSeason = seasons[Math.floor((currentMonth - 1) / 3)];
    const nextSeason = seasons[currentSeason === 'FALL' ? 0 : seasons.indexOf(currentSeason) + 1];
    const nextYear = nextSeason === 'WINTER' ? currentYear + 1 : currentYear;

    let animeList = [];
    let responseText = '';

    if (data === 'browse_trending') {
      animeList = await fetchAnimeList('ANIME', ['TRENDING_DESC'], currentYear, currentSeason);
      responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (data === 'browse_popular') {
      animeList = await fetchAnimeList('ANIME', ['POPULARITY_DESC'], currentYear, currentSeason);
      responseText = `Popular Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (data === 'browse_upcoming') {
      animeList = await fetchAnimeList('ANIME', ['POPULARITY_DESC'], nextYear, nextSeason);
      responseText = `Upcoming Animes in ${nextSeason} ${nextYear}:\n\n`;
    }

    responseText += animeList.slice(0, 20).map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``).join('\n');

    bot.editMessageText(responseText, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: generateKeyboard(data),
      parse_mode: 'Markdown',
    });
  });
};

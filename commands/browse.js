const axios = require('axios');

const ANILIST_URL = 'https://graphql.anilist.co/';

async function getAnimeList(type, sort, year, season, page = 1, perPage = 20) {
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
    const data = response.data.data.Page.media;
    return data;
  } catch (error) {
    console.error('Error fetching anime list:', error);
    return [];
  }
}

function getKeyboard(currentSelection) {
  return {
    inline_keyboard: [
      [
        { text: currentSelection === 'trending' ? '• Trending •' : 'Trending', callback_data: 'trending' },
        { text: currentSelection === 'popular' ? '• Popular •' : 'Popular', callback_data: 'popular' },
        { text: currentSelection === 'upcoming' ? '• Upcoming •' : 'Upcoming', callback_data: 'upcoming' }
      ]
    ]
  };
}

module.exports = function (bot) {
  bot.onText(/\/browse/, async (msg) => {
    const chatId = msg.chat.id;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const currentSeason = seasons[Math.floor((currentMonth - 1) / 3)];

    const trending = await getAnimeList('ANIME', ['TRENDING_DESC'], currentYear, currentSeason);
    const responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n` +
      trending.slice(0, 20).map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``).join('\n');

    const opts = {
      reply_markup: getKeyboard('trending'),
      parse_mode: 'Markdown'
    };

    bot.sendMessage(chatId, responseText, opts)
  });

  bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const currentSeason = seasons[Math.floor((currentMonth - 1) / 3)];
    const nextSeason = seasons[currentSeason === 'FALL' ? 0 : seasons.indexOf(currentSeason) + 1];
    const nextYear = nextSeason === 'WINTER' ? currentYear + 1 : currentYear;

    let animeList = [];
    let responseText = '';

    if (data === 'trending') {
      animeList = await getAnimeList('ANIME', ['TRENDING_DESC'], currentYear, currentSeason);
      responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (data === 'popular') {
      animeList = await getAnimeList('ANIME', ['POPULARITY_DESC'], currentYear, currentSeason);
      responseText = `Popular Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (data === 'upcoming') {
      animeList = await getAnimeList('ANIME', ['POPULARITY_DESC'], nextYear, nextSeason);
      responseText = `Upcoming Animes in ${nextSeason} ${nextYear}:\n\n`;
    }

    responseText += animeList.slice(0, 20).map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``).join('\n');

    bot.editMessageText(responseText, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: getKeyboard(data),
      parse_mode: 'Markdown',
    });
  });
};
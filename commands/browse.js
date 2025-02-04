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

  const variables = { type, sort, year, season, page, perPage };

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
        {
          text: currentSelection === 'trending' ? '• Trending •' : 'Trending',
          callback_data: 'browse:trending'
        },
        {
          text: currentSelection === 'popular' ? '• Popular •' : 'Popular',
          callback_data: 'browse:popular'
        },
        {
          text: currentSelection === 'upcoming' ? '• Upcoming •' : 'Upcoming',
          callback_data: 'browse:upcoming'
        }
      ]
    ]
  };
}

module.exports = {
  name: 'browse',
  version: 1.0,
  longDescription:"Get info about popular, trending, or upcoming anime",
  shortDescription: "Browse anime by trending, popular, or upcoming",
  guide: "{pn}",
  category: ['Anime & Manga Information', 3],
  lang: {
    usage: "{pn}",
    error: "An error occured",
  },


  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const currentSeason = seasons[Math.floor((currentMonth - 1) / 3)];

    const trending = await fetchAnimeList('ANIME', ['TRENDING_DESC'], currentYear, currentSeason);
    let responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n` +
      trending.slice(0, 20)
        .map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``)
        .join('\n');

    const opts = {
      reply_markup: generateKeyboard('trending'),
      parse_mode: 'Markdown'
    };

    bot.sendMessage(chatId, responseText, opts);
  },


  onCallback: async ({ bot, callbackQuery, params }) => {
    const message = callbackQuery.message;

    const selection = params[0];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const currentSeason = seasons[Math.floor((currentMonth - 1) / 3)];

    let targetYear = currentYear;
    let targetSeason = currentSeason;
    if (selection === 'upcoming') {
      const currentIndex = seasons.indexOf(currentSeason);
      if (currentSeason === 'FALL') {
        targetSeason = seasons[0];
        targetYear = currentYear + 1;
      } else {
        targetSeason = seasons[currentIndex + 1];
      }
    }

    let animeList = [];
    let responseText = '';

    if (selection === 'trending') {
      animeList = await fetchAnimeList('ANIME', ['TRENDING_DESC'], currentYear, currentSeason);
      responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (selection === 'popular') {
      animeList = await fetchAnimeList('ANIME', ['POPULARITY_DESC'], currentYear, currentSeason);
      responseText = `Popular Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (selection === 'upcoming') {
      animeList = await fetchAnimeList('ANIME', ['POPULARITY_DESC'], targetYear, targetSeason);
      responseText = `Upcoming Animes in ${targetSeason} ${targetYear}:\n\n`;
    } else {
      responseText = 'Invalid selection.';
    }

    responseText += animeList.slice(0, 20)
      .map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``)
      .join('\n');

    try {
      await bot.editMessageText(responseText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: generateKeyboard(selection),
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Error editing message:', error);
    }
    bot.answerCallbackQuery(callbackQuery.id);
  }
};

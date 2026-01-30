const { getMediaList } = require('../utilities/anilistUtils');

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
  longDescription: "Get info about popular, trending, or upcoming anime",
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

    const result = await getMediaList({
      type: 'ANIME',
      sort: 'TRENDING_DESC',
      seasonYear: currentYear,
      season: currentSeason,
      perPage: 20
    });

    let responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n` +
      result.media.slice(0, 20)
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

    let result;
    let responseText = '';

    if (selection === 'trending') {
      result = await getMediaList({
        type: 'ANIME',
        sort: 'TRENDING_DESC',
        seasonYear: currentYear,
        season: currentSeason,
        perPage: 20
      });
      responseText = `Trending Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (selection === 'popular') {
      result = await getMediaList({
        type: 'ANIME',
        sort: 'POPULARITY_DESC',
        seasonYear: currentYear,
        season: currentSeason,
        perPage: 20
      });
      responseText = `Popular Animes in ${currentSeason} ${currentYear}:\n\n`;
    } else if (selection === 'upcoming') {
      result = await getMediaList({
        type: 'ANIME',
        sort: 'POPULARITY_DESC',
        seasonYear: targetYear,
        season: targetSeason,
        perPage: 20
      });
      responseText = `Upcoming Animes in ${targetSeason} ${targetYear}:\n\n`;
    } else {
      responseText = 'Invalid selection.';
    }

    if (result && result.media) {
      responseText += result.media.slice(0, 20)
        .map(anime => `⚬ \`${anime.title.english || anime.title.romaji}\``)
        .join('\n');
    }

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

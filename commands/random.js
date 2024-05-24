const axios = require('axios');

const ANILIST_URL = 'https://graphql.anilist.co/';

async function getRandomAnime() {
  const query = `
    query {
      Page(perPage: 5000) {
        media(type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          genres
          format
          startDate {
            year
            month
            day
          }
          description
          episodes
          season
          seasonYear
          status
          averageScore
          tags {
            name
          }
          relations {
            edges {
              relationType(version: 2)
              node {
                id
                title {
                  romaji
                }
              }
            }
          }
        }
      }
    }
  `;
//sort: SCORE_DESC, 
  try {
    const response = await axios.post(ANILIST_URL, { query });
    const data = response.data.data.Page;

    if (data.media.length === 0) {
      throw new Error('No anime found in the retrieved page.');
    }

    const randomIndex = Math.floor(Math.random() * data.media.length);
    const randomAnime = data.media[randomIndex];

    return randomAnime;
  } catch (error) {
    console.error('Error fetching anime info:', error);
    throw error;
  }
}

module.exports = function (bot) {
  bot.onText(/\/random/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const anime = await getRandomAnime();

      const title = anime.title.romaji || 'N/A';
      const englishTitle = anime.title.english || 'N/A';
      const nativeTitle = anime.title.native || 'N/A';
      const genres = anime.genres.join(', ') || 'N/A';
      const episodes = anime.episodes || 'Airing';
      const format = anime.format;
      const startDate = `${anime.startDate.day}-${anime.startDate.month}-${anime.startDate.year}`;
      const season = anime.season;
      const seasonYear = anime.seasonYear;
      const status = anime.status;
      const averageScore = anime.averageScore;
      const tags = anime.tags.slice(0, 5).map(tag => tag.name).join(', ') || 'N/A';
      const coverImageUrl = `https://img.anili.st/media/${anime.id}`;
      const moreInfoUrl = `https://anilist.co/anime/${anime.id}`;

      let relations = '';
      anime.relations.edges.forEach(edge => {
        if (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL') {
          relations += `*${edge.relationType}:* \`${edge.node.title.romaji}\n\``;
        }
      });

      const caption = `
*➤ Title:* • \`${title}\`\n• \`${englishTitle}\`\n• \`${nativeTitle}\`\n
*➤ Type:* ${format}
*➤ Start Date:* ${startDate}
*➤ Season:* ${season}, ${seasonYear}
*➤ Episodes:* ${episodes}
*➤ Status:* ${status}
*➤ Score:* ${averageScore}
*➤ Genres:* ${genres}
*➤ Tags:* ${tags}
${relations ? '*➤ Relations:*\n' + relations : ''}
`;

      await bot.sendPhoto(chatId, coverImageUrl, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'More info', url: moreInfoUrl }]
          ]
        }
      });
    } catch (error) {
      bot.sendMessage(chatId, 'Sorry, there was an error fetching the anime information.');
    }
  });
};


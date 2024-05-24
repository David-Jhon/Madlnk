const axios = require('axios');

const ANILIST_URL = 'https://graphql.anilist.co/';

module.exports = function (bot) {
  bot.on('text', async (msg) => {
    const command = msg.text.trim().split(' ')[0].toLowerCase();
    const mangaTitle = msg.text.trim().split(' ').slice(1).join(' ');

    if (command === '/mangainfo') {
      if (!mangaTitle) {
        return bot.sendMessage(msg.chat.id, 'Please provide a manga title to search for.\nFormat: /manga <manga name> \nExample: /mangainfo naruto');
      }

      try {
        const query = `
          query ($title: String) {
            Media (search: $title, type: MANGA) {
              id
              title {
                romaji
                english
                native
              }
              description
              coverImage {
                medium
                large
              }
              genres
              format
              startDate {
                year
                month
                day
              }
              endDate {
                year
                month
                day
              }
              chapters
              volumes
              status
              averageScore
              genres
              countryOfOrigin
            }
          }
        `;

        const variables = {
          title: mangaTitle
        };

        const response = await axios.post(ANILIST_URL, { query, variables });
        const mangaData = response.data.data.Media;

        if (!mangaData) {
          return bot.sendMessage(msg.chat.id, `No manga found with the title: ${mangaTitle}`);
        }

        const { romaji, english, native } = mangaData.title;
      let title = '';
      if (english) {
          title += `\`${english}\`\n`;
      }
        if (romaji) {
          title += `• \`${romaji}\`\n`;
        }
        if (native) {
          title += `• \`${native}\`\n`;
        }
        
        const description = mangaData.description.replace(/<[^>]+>/g, ' ').substring(0, 900) + "...";
        
        // const coverImage = mangaData.coverImage.large;
        const genres = mangaData.genres.join(', ');
        const format = mangaData.format;
        const startDate = `${mangaData.startDate.day}-${mangaData.startDate.month}-${mangaData.startDate.year}`;
        const endDate = mangaData.endDate ? `${mangaData.endDate.day}-${mangaData.endDate.month}-${mangaData.endDate.year}` : "N/A";
        const chapters = mangaData.chapters || "N/A";
        const vollums = mangaData.volumes || "N/A";
        const status = mangaData.status;
        const averageScore = mangaData.averageScore;
        const link = mangaData.id;
        const countryOfOrigin = mangaData.countryOfOrigin

        const message = `❏ *Title:* ${title}\n
*➤ Type:* ${format}
*➤ Genres:* ${genres}
*➤ Start Date:* ${startDate}
*➤ End Date:* ${endDate}
*➤ Chapters:* ${chapters}
*➤ Volumes:* ${vollums}
*➤ Status:* ${status}
*➤ Country:* ${countryOfOrigin}
*➤ Score:* ${averageScore}\n
*➤ Description:* ${description}
*➤ Link:* [View on AniList](https://anilist.co/manga/${link})`
        ;
        await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(error);
        bot.sendMessage(msg.chat.id, 'An error occurred while fetching manga information.\nTry the romanji name or a proper name.');
      }
    }
  });
}
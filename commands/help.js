module.exports = function (bot) {
  bot.on('message', (message) => {
    if (message.text === '/help') {
      bot.getMe().then(botInfo => {
        let botName = `${botInfo.first_name}`;
        if (!botName.includes('Bot')) {
          botName += ' Bot';
        }

        const helpResponse = `
*Welcome to* \`${botName}\`*! 🤖*

*Getting Started*
• */start* - Get started with Bot
• */help* - Show this help message

*Anime & Manga Channels*
• */anime* - Get anime channel
• */manga* - Get manga channel

*Anime & Manga Information*
• */animeinfo* - Get detailed information about an anime
• */mangainfo* - Get detailed information about a manga
• */anilist* - View your AniList activity and stats
• */lastairing* - Recent airing anime episodes
• */top* - Retrieve top anime or manga titles
• */browse* - Get info about popular, trending, or upcoming anime
• */random* - Get a random anime and start watching it
• */fillers* - Search for anime fillers

*Download*  
• */nhentai* - Get detailed info and read doujin

*Requests & Suggestions*
• */request* - Request anime/manga or give suggestions

*Other Utilities*
• */list* - Get the list of the Archive
• */upload* - Upload a photo, GIF, or video to Imgur`;

        bot.sendMessage(message.chat.id, helpResponse, { parse_mode: 'Markdown' });
      });
    }
  });
};

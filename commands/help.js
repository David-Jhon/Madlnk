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
• **/help** - Show this help message

*Channels*
• */anime* - Get anime channel
• */manga* - Get manga channel

*Information*
• */animeinfo* - Get information about an anime
• */mangainfo* - Get information about a manga
• */anilist* - View your AniList activity and stats

*Utilities*
• */request* - Request anime/manga or give suggestions
• */list* - Get the list of Archive
• */madchat* - Chat with MADBot, your anime AI assistant
• */lastairing* - Recent airing anime episodes
• */top* - Retrieve top anime or manga titles
• */browse* - Get info about popular, trending or upcoming animes
• */random* - Get a random anime and start watching it`;
        bot.sendMessage(message.chat.id, helpResponse, {parse_mode: 'Markdown'});
      });
    }
  });
};

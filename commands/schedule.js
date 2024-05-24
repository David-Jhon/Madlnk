const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.livechart.me/feeds/episodes';

module.exports = function (bot) {
bot.onText(/\/lastairing/, (msg) => {
  axios.get(url)
    .then(response => {
      const $ = cheerio.load(response.data);
      const channel = $('channel');
      const items = channel.find('item');

      let responseText = `❏ *Anime episodes that have aired in the last 24 hours:*\n\n`;

      items.each((index, item) => {
        const title = $(item).find('title').text();
        
        responseText += `• \`${title}\`\n`;
      });

      bot.sendMessage(msg.chat.id, responseText, {parse_mode: 'Markdown'});
    })
    .catch(error => {
      console.error(`Error fetching: ${error}`);
      bot.sendMessage(msg.chat.id, 'An error occurred while fetching the data. Please try again later.');
    });
});
}
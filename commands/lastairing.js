const axios = require("axios");
const cheerio = require("cheerio");

const url = "https://www.livechart.me/feeds/episodes";

module.exports = {
  name: "lastairing",
  version: 1.0,
  longDescription: "Fetches the latest anime episodes that have aired in the last 24 hours.",
  shortDescription: "Get the latest aired anime episodes",
  guide: "{pn}",
  category: ['Anime & Manga Information', 3],
  lang: {
    error: "An error occurred while fetching the data. Please try again later."
  },
  onStart: async ({ bot, msg, args }) => {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const items = $("channel").find("item");
      let responseText = "❏ *Anime episodes that have aired in the last 24 hours:*\n\n";
      items.each((index, item) => {
        const title = $(item).find("title").text();
        responseText += `• \`${title}\`\n`;
      });
      await bot.sendMessage(msg.chat.id, responseText, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error fetching data:", error);
      await bot.sendMessage(msg.chat.id, module.exports.lang.error);
    }
  },
};

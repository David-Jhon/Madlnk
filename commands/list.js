const axios = require("axios");

module.exports = {
  name: "list",
  version: 1.0,
  longDescription: 'Display a list of available titles for Manga, Manhwa, Manhua, or Anime',
  shortDescription: 'Get the list of the Archive',
  guide: "{pn}",
  category: ['Other Utilities', 6],
  lang: {
    noData: "No data found for the selected category.",
    error: "Failed to fetch data."
  },


  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const keyboard = [
      [{ text: "Manga", callback_data: "list:manga:0:init" }],
      [{ text: "Manhwa", callback_data: "list:manhwa:0:init" }],
      [{ text: "Manhua", callback_data: "list:manhua:0:init" }],
      [{ text: "Anime", callback_data: "list:anime:0:init" }]
    ];

    const replyMarkup = { inline_keyboard: keyboard };
    await bot.sendMessage(
      chatId,
      "Please select a category to see the list of available titles\n\n\n[NOTE: Each category is updated regularly with the latest titles]",
      { reply_markup: replyMarkup }
    );
  },


  onCallback: async ({ bot, callbackQuery, params }) => {
    
    const dataParts = callbackQuery.data.split(":");
    if (dataParts[0] !== "list") {
      return bot.answerCallbackQuery(callbackQuery.id);
    }
    const action = dataParts[1];
    const pageString = dataParts[2];
    const initFlag = dataParts[3] || "";
    const currentPage = parseInt(pageString, 10);
    const chatId = callbackQuery.message.chat.id;
    let url, category;

    switch (action) {
      case "manga":
        url =
          "https://api.telegra.ph/getPage/List-of-Manga-Part-1-07-18?return_content=true";
        category = "Manga";
        break;
      case "manhwa":
        url =
          "https://api.telegra.ph/getPage/List-of-Manhwa-07-18?return_content=true";
        category = "Manhwa";
        break;
      case "manhua":
        url =
          "https://api.telegra.ph/getPage/List-of-Manhua-07-25?return_content=true";
        category = "Manhua";
        break;
      case "anime":
        url =
          "https://api.telegra.ph/getPage/List-of-Anime-Part-1-10-23?return_content=true";
        category = "Anime";
        break;
      default:
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    try {
      const fetchedData = await fetchData(url);
      if (!fetchedData) {
        await bot.sendMessage(chatId, module.exports.lang.noData);
        return;
      }

      const itemsPerPage = 20;
      const list = await fetchAnimeData(fetchedData);
      const paginatedList = list.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
      );
      const numPages = Math.ceil(list.length / itemsPerPage);

      let keyboard = [];
      if (numPages > 1) {
        let row = [];
        if (currentPage > 0) {
          row.push({
            text: "⬅️ Previous",
            callback_data: `list:${action}:${currentPage - 1}`
          });
        }
        if (currentPage < numPages - 1) {
          row.push({
            text: "Next ➡️",
            callback_data: `list:${action}:${currentPage + 1}`
          });
        }
        if (row.length) keyboard.push(row);
      }
      const replyMarkup = { inline_keyboard: keyboard };

      const messageText = `❏ *Here is the list of ${category}*\n\n${paginatedList.join(
        "\n"
      )}`;

      if (initFlag === "init") {
        await bot.sendMessage(chatId, messageText, {
          parse_mode: "Markdown",
          disable_web_page_preview: true,
          reply_markup: replyMarkup
        });
      } else {
        await bot.editMessageText(messageText, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
          reply_markup: replyMarkup
        });
      }
      return bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error("Error processing callback query:", error);
      await bot.sendMessage(chatId, module.exports.lang.error);
    }
  }
};

async function fetchData(url) {
  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      return response.data;
    } else {
      console.error("Non-200 status code:", response.status);
      return null;
    }
  } catch (error) {
    console.error("Error fetching data from API:", error);
    return null;
  }
}

async function fetchAnimeData(data) {
  const content = data["result"]["content"];
  const list = [];
  let itemNumber = 1;
  for (const item of content) {
    if (typeof item === "object") {
      const children = item.children || [];
      for (const child of children) {
        if (child instanceof Object && child["tag"] === "a") {
          const text = child.children[0] || "";
          const href = child.attrs.href || "";
          list.push(`*${itemNumber}.* [${text}](${href})`);
          itemNumber++;
        }
      }
    }
  }
  return list;
}

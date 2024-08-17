const axios = require('axios');

const client = axios.create({
  baseURL: "https://api.imgur.com/3/",
  headers: {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'cookie': process.env.IMGUR_COOKIES,
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'Referer': 'https://imgur.com/',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
});

const uploadImage = async (url) => {
  try {
    const response = await client.post("image", {
      image: url,
    });
    return response.data.data.link;
  } catch (error) {
    console.error('Error uploading image:', error.response ? error.response.data : error.message);
    throw error;
  }
};

module.exports = function (bot) {
  bot.onText(/\/upload/, async (msg) => {
    const chatId = msg.chat.id;

    if (!msg.reply_to_message || 
        (!msg.reply_to_message.photo && 
         !msg.reply_to_message.document &&
         !msg.reply_to_message.video &&
         !msg.reply_to_message.animation)) {
      return bot.sendMessage(chatId, "Please reply to the media you want to upload (photo, GIF, video).");
    }

    const array = [];
    const mediaArray = [];

    if (msg.reply_to_message.photo) {
      mediaArray.push(msg.reply_to_message.photo.pop());
    } else if (msg.reply_to_message.document) {

      mediaArray.push(msg.reply_to_message.document);
    } else if (msg.reply_to_message.video) {

      mediaArray.push(msg.reply_to_message.video);
    } else if (msg.reply_to_message.animation) {

      mediaArray.push(msg.reply_to_message.animation);
    }

    for (const media of mediaArray) {
      const fileId = media.file_id;
      try {

        const fileUrl = await bot.getFileLink(fileId);

        const res = await uploadImage(fileUrl);
        array.push(res);
      } catch (err) {
        console.log(err);
      }
    }

    const failedCount = mediaArray.length - array.length;
    bot.sendMessage(
      chatId,
      `» Successfully uploaded ${array.length} media file(s)\nFailed: ${failedCount}\n» Image links:\n${array.join("\n")}`
    );
  });
};

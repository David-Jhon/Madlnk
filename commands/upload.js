const axios = require('axios');

const client = axios.create({
  baseURL: "https://api.imgur.com/3/",
  headers: {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    "cookie": "postpagebeta=1; frontpagebetav2=1; pp=4290040768195262; postpagebetalogged=1; ana_id=0; is_emerald=0; IMGURUIDJAFO=2c2a4d31874a3c0ac8132a1b992e821c54967bbadef77e5c09330168a844b939; SESSIONDATA=%7B%22sessionCount%22%3A1%2C%22sessionTime%22%3A1723897622486%7D; authautologin=5f3004b63c2c034a54fe177747586e91%7E7G5U79z3WlAAEsVTj1XcTKmbIv1o6gHa; IMGURSESSION=3d3d080485821bb46a8938ddef100755; just_logged_in=1; accesstoken=e16d75eb9974728da56d8752ffc5b7ed17b12349; is_authed=1; user_id=160721433; _nc=1; mp_d7e83c929082d17b884d6c71de740244_mixpanel=%7B%22distinct_id%22%3A%20160721433%2C%22%24device_id%22%3A%20%22191600e885a99a8c-06501b3c4d9478-26001e51-118ac1-191600e885a99a8c%22%2C%22signed_in%22%3A%20true%2C%22%24initial_referrer%22%3A%20%22%24direct%22%2C%22%24initial_referring_domain%22%3A%20%22%24direct%22%2C%22__mps%22%3A%20%7B%7D%2C%22__mpso%22%3A%20%7B%7D%2C%22__mpus%22%3A%20%7B%7D%2C%22__mpa%22%3A%20%7B%7D%2C%22__mpu%22%3A%20%7B%7D%2C%22__mpr%22%3A%20%5B%5D%2C%22__mpap%22%3A%20%5B%5D%2C%22imgur_platform%22%3A%20%22desktop%20web%22%2C%22version_name%22%3A%20%22665a2d0%22%2C%22user%20agent%22%3A%20%22Mozilla%2F5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)%20Chrome%2F127.0.0.0%20Safari%2F537.36%22%2C%22%24user_id%22%3A%20160721433%7D",
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

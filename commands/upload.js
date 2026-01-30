const axios = require("axios");

const client = axios.create({
  baseURL: "https://api.imgur.com/3/",
  headers: {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    cookie: process.env.IMGUR_COOKIES,
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    Referer: "https://imgur.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  },
});

const uploadImage = async (url) => {
  try {
    const response = await client.post("image", { image: url });
    return response.data.data.link;
  } catch (error) {
    console.error(
      "Error uploading image:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

module.exports = {
  name: "upload",
  version: 1.0,
  longDescription: "Uploads media (photo, GIF, video, sticker) from a replied-to message to Imgur and returns the link(s).",
  shortDescription: "Upload media to Imgur.",
  guide: "{pn} (reply to a media message)",
  category: ['Other Utilities', 6],
  lang: {
    noReply:
      "Please reply to the media you want to upload (photo, GIF, video, or sticker).",
    success: (successCount, failedCount, links) =>
      `» Successfully uploaded ${successCount} media file(s)\nFailed: ${failedCount}\n» Media links:\n${links}`,
    error: "An error occurred while uploading your media. Please try again later.",
  },
  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    if (
      !msg.reply_to_message ||
      (!msg.reply_to_message.photo &&
        !msg.reply_to_message.document &&
        !msg.reply_to_message.video &&
        !msg.reply_to_message.animation &&
        !msg.reply_to_message.sticker)
    ) {
      return bot.sendMessage(chatId, module.exports.lang.noReply);
    }

    const uploadedLinks = [];
    const mediaArray = [];

    if (msg.reply_to_message.photo) {
      mediaArray.push(msg.reply_to_message.photo.pop());
    } else if (msg.reply_to_message.document) {
      mediaArray.push(msg.reply_to_message.document);
    } else if (msg.reply_to_message.video) {
      mediaArray.push(msg.reply_to_message.video);
    } else if (msg.reply_to_message.animation) {
      mediaArray.push(msg.reply_to_message.animation);
    } else if (msg.reply_to_message.sticker) {
      mediaArray.push(msg.reply_to_message.sticker);
    }

    for (const media of mediaArray) {
      const fileId = media.file_id;
      try {
        const fileUrl = await bot.getFileLink(fileId);
        const link = await uploadImage(fileUrl);
        uploadedLinks.push(link);
      } catch (err) {
        console.error("Upload failed for fileId:", fileId, err);
      }
    }

    const failedCount = mediaArray.length - uploadedLinks.length;
    const responseMessage = module.exports.lang.success(
      uploadedLinks.length,
      failedCount,
      uploadedLinks.join("\n")
    );
    await bot.sendMessage(chatId, responseMessage);
  },
};

const axios = require("axios");

const userStates = new Map();
const cooldowns = new Map();
const REQUEST_COOLDOWN = 120000;

async function sendAdminMessage(text) {
  const response = await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      chat_id: process.env.GC_ID,
      text: text,
      parse_mode: "HTML",
    }
  );
  return response.data;
}

module.exports = {
  name: "request",
  version: 1.0,
  longDescription: "Allows users to submit requests or feedback to the admin.",
  shortDescription: "Submit a request or feedback",
  guide: "{pn}",
  category: ['Requests & Suggestions', 5],
  lang: {
    usage: "Send /request to initiate a request or feedback.",
    waiting:
      "📝 What would you like to request or provide feedback about?\n\nExamples:\n• Anime: <Name>\n• Manga: <Name>\n• Manhua: <Name>\n• Manhwa: <Name>\n• Feedback: General feedback about...",
    cooldown: (remaining) =>
      `Please wait ${remaining} seconds before making another request.`,
    sent: "✅ Your request has been sent to admin!",
    error: "❌ Failed to send your request. Please try again.",
  },
  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (cooldowns.has(userId)) {
      const remaining = Math.ceil(
        (cooldowns.get(userId) + REQUEST_COOLDOWN - Date.now()) / 1000
      );
      return bot.sendMessage(chatId, module.exports.lang.cooldown(remaining));
    }
    try {
      const formatMessage = await bot.sendMessage(
        chatId,
        module.exports.lang.waiting
      );
      userStates.set(userId, {
        awaitingRequest: true,
        formatMessageId: formatMessage.message_id,
      });
    } catch (error) {
      console.error("Error sending format message:", error);
    }
  },
  onChat: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userState = userStates.get(userId);
    if (userState?.awaitingRequest) {
      /*if (msg.text.startsWith('/')) {
        return;
      }*/
      try {
        await sendAdminMessage(
          `✉️ | A new task from User\n👤 | @${msg.from.username}\n🪪 | UID: ${userId}\n\n➤  ${msg.text}`
        );
        await bot.sendMessage(chatId, module.exports.lang.sent);
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), REQUEST_COOLDOWN);
      } catch (error) {
        console.error("Failed to send request:", error);
        await bot.sendMessage(chatId, module.exports.lang.error);
      }
      try {
        if (userState.formatMessageId) {
          await bot.deleteMessage(chatId, userState.formatMessageId);
        }
      } catch (deleteError) {
        console.error("Failed to delete format message:", deleteError);
      }
      userStates.delete(userId);
    }
  },
  onCallback: null,
};

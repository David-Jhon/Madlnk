const axios = require('axios');

let sent = false;
let sentMessageId;

module.exports = function (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    if (messageText === '/request') {
      sent = true;


      const requestFormatMessage = await bot.sendMessage(chatId, 'What would you like to request?\nRequest format:\nAnime: <Anime Name>\nManga: <Manga Name>\nManhua: <Manhua Name>\nManhwa: <Manhwa Name>');
      sentMessageId = requestFormatMessage.message_id;
    } else if (sent) {
      const requestData = `✉️ | A new task from User\n👤 | @${msg.from.username}\n🪪 | UID: ${msg.from.id}\n\n➤  ${messageText}`;

      const adminGroupChatId = process.env.GC_ID;
      const botToken = process.env.BOT_TOKEN;

      try {
        await sendTelegramMessage(botToken, adminGroupChatId, requestData);
        bot.sendMessage(chatId, 'Got it! Your request has been sent to the admin.');

        if (sentMessageId) {
          try {
            await bot.deleteMessage(chatId, sentMessageId);
            //console.log(`Request format message with ID ${sentMessageId} unsent successfully.`);
          } catch (unsendError) {
           console.error('Failed to unsend request format message:', unsendError);
          }
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        bot.sendMessage(chatId, 'An error occurred while sending the request.');
      }

      sent = false;
    }
  });
}

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text
    });

    console.log('Message sent:', response.data);
    return response.data;
  } catch (error) {
    throw new Error('Failed to send message via Telegram API:', error);
  }
}
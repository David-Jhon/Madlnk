const axios = require('axios');

let loggingEnabled = true;

async function logMessage(msg, bot) {
  const chatId = msg.chat.id || '';
  const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');
  let logEntry = `🤖『 Bot Logs 』\n\n👤 | ${senderName}\n🪪 | @${msg.from.username}\nID  | ${msg.from.id}\n💬 | ${chatId}\n\nMessage:\n» `;

  if (msg.text) {
    logEntry += msg.text;
  } else if (msg.photo) {
    const highestResPhoto = msg.photo[msg.photo.length - 1];
    logEntry += `Photo [File ID: ${highestResPhoto.file_id}]`;
  } else if (msg.document) {
    logEntry += `Document [File ID: ${msg.document.file_id}, Name: ${msg.document.file_name}]`;
  } else if (msg.sticker) {
    logEntry += `Sticker [File ID: ${msg.sticker.file_id}]`;
  } else if (msg.video) {
    logEntry += `Video [File ID: ${msg.video.file_id}]`;
  } else {
    logEntry += 'some other type of message';
  }

  console.log(logEntry);

  // Only send log to admin chat if logging is enabled
  if (loggingEnabled) {
    const adminGroupChatId = process.env.GC_ID;
    const botToken = process.env.BOT_TOKEN;
    try {
      await sendTelegramMessage(botToken, adminGroupChatId, logEntry);
    } catch (error) {
      console.error('Failed to send log message to admin group chat:', error);
    }
  }
}

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text
    });
  } catch (error) {
    console.error('Failed to send log message via Telegram API:', error);
  }
}

async function processCommand(msg, bot) {
  if (msg.from.id !== 1263175965) return; // Ensure only the bot owner can control logging

  const command = msg.text.split(' ')[1];

  if (command === 'off') {
    loggingEnabled = false;
    await bot.sendMessage(msg.chat.id, 'Logging is now turned off.');
  } else if (command === 'on') {
    loggingEnabled = true;
    await bot.sendMessage(msg.chat.id, 'Logging is now turned on.');
  }
}

module.exports = { logMessage, processCommand };

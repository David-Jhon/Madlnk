const axios = require('axios');

const adminGroupChatId = process.env.GC_ID;
const botToken = process.env.BOT_TOKEN;

let loggingEnabled = true;

async function logMessage(msg) {
  const chatId = msg.chat.id || '';
  const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');
  let logEntry = `🤖『 Bot Logs 』\n\n👤 | ${senderName}\n🪪 | @${msg.from.username}\nID  | ${msg.from.id}\n💬 | ${chatId}\n\nMessage:\n» `;

  if (msg.text) {
    logEntry += msg.text;
    console.log(logEntry);

    // Only send log to admin chat if logging is enabled
    if (loggingEnabled) {
      try {
        await sendTelegramMessage(botToken, adminGroupChatId, logEntry);
      } catch (error) {
        console.error('Failed to send log message to admin group chat:', error);
      }
    }
  } else {
    // Forward non-text messages to the admin group chat if logging is enabled
    if (loggingEnabled) {
      try {
        await forwardTelegramMessage(botToken, adminGroupChatId, msg.chat.id, msg.message_id);
      } catch (error) {
        console.error('Failed to forward message to admin group chat:', error);
      }
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

async function forwardTelegramMessage(botToken, chatId, fromChatId, messageId) {
  const url = `https://api.telegram.org/bot${botToken}/forwardMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId
    });
  } catch (error) {
    console.error('Failed to forward message via Telegram API:', error);
  }
}

async function processCommand(msg, bot) {
  if (msg.from.id !== 1263175965) return;

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

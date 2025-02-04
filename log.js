const axios = require('axios');

const adminGroupChatId = process.env.GC_ID;
const botToken = process.env.BOT_TOKEN;

let loggingEnabled = true;

async function logMessage(msg) {
  const chatId = msg.chat.id?.toString() || '';
  const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');

  if (chatId === adminGroupChatId) {
    return;
  }

  let logEntry = `🤖『 Bot Logs 』\n\n👤 | ${senderName}\n🪪 | @${msg.from.username || 'no-username'}\nID  | ${msg.from.id}\n💬 | ${chatId}\n\nMessage:\n» `;

  if (msg.text) {
    logEntry += msg.text;
    console.log(logEntry);

    if (loggingEnabled) {
      try {
        await sendTelegramMessage(adminGroupChatId, logEntry);
      } catch (error) {
        console.error('Failed to send log:', error);
      }
    }
  } else if (loggingEnabled) {
    try {
      await forwardTelegramMessage(msg.chat.id, msg.message_id);
    } catch (error) {
      console.error('Failed to forward message:', error);
    }
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Telegram API error:', error.response?.data);
  }
}

async function forwardTelegramMessage(fromChatId, messageId) {
  const url = `https://api.telegram.org/bot${botToken}/forwardMessage`;
  try {
    await axios.post(url, {
      chat_id: adminGroupChatId,
      from_chat_id: fromChatId,
      message_id: messageId
    });
  } catch (error) {
    console.error('Forward message error:', error.response?.data);
  }
}

async function processCommand(msg, bot) {
  if (msg.from.id.toString() !== process.env.OWNER_ID) return;

  const [_, command] = msg.text.split(' ');
  
  if (command === 'off') {
    loggingEnabled = false;
    await bot.sendMessage(msg.chat.id, '📴 | Logging disabled');
  } else if (command === 'on') {
    loggingEnabled = true;
    await bot.sendMessage(msg.chat.id, '📲 | Logging enabled');
  }
}

module.exports = { logMessage, processCommand };
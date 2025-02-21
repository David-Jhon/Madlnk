const axios = require('axios');

const adminGroupChatId = process.env.GC_ID;
const botToken = process.env.BOT_TOKEN;

const timestamp = () => new Date().toISOString().replace('T', ' ').split('.')[0];

let loggingEnabled = true;

async function logMessage(msg) {
  const chatId = msg.chat.id?.toString() || '';
  const senderName =
    msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');

    console.log('\x1b[36m%s\x1b[0m', `[${timestamp()}] [INFO]\n`, "MESSAGE:", msg, `\n`);


  if (chatId === adminGroupChatId) {
    return;
  }

  let logEntry = `🤖『 Bot Logs 』\n\n👤 | ${senderName}\n🪪 | @${msg.from.username || 'no-username'}\nID  | ${msg.from.id}\n💬 | ${chatId}\n\nMessage:\n» `;

  if (msg.text) {
    logEntry += msg.text;

    if (loggingEnabled) {
      try {
        await sendTelegramMessage(adminGroupChatId, logEntry);
      } catch (error) {
        console.error('Failed to send log:', error);
      }
    }
  } else if (loggingEnabled) {
    try {
      await forwardTelegramMessage(chatId, msg.message_id);
    } catch (error) {
      console.error('Failed to forward message:', error);
    }
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
    });
    return response;
  } catch (error) {
    console.error('Telegram API error:', error.response?.data);
    throw error;
  }
}

async function forwardTelegramMessage(fromChatId, messageId) {
  const url = `https://api.telegram.org/bot${botToken}/forwardMessage`;
  try {
    const response = await axios.post(url, {
      chat_id: adminGroupChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
    return response;
  } catch (error) {
    console.error('Forward message error:', error.response?.data);
    throw error;
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

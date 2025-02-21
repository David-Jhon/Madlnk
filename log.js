const axios = require('axios');

const adminGroupChatId = process.env.GC_ID;
const botToken = process.env.BOT_TOKEN;

const COLORS = {
  RESET: "\x1b[0m",
  RED: '\x1b[31m%s\x1b[0m',
  GREEN: '\x1b[32m%s\x1b[0m',
  YELLOW: '\x1b[33m%s\x1b[0m',
  CYAN: '\x1b[36m%s\x1b[0m',
};

const timestamp = () => new Date().toISOString().replace('T', ' ').split('.')[0];

let loggingEnabled = true;

async function logMessage(msg) {
  const chatId = msg.chat.id?.toString() || '';
  const senderName =
    msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');

  console.log(COLORS.CYAN, `[${timestamp()}] [INFO]\n`, "MESSAGE:", msg, `\n`);

  if (chatId === adminGroupChatId) {
    return;
  }

  let logEntry = `🤖『 Bot Logs 』\n\n👤 | ${senderName}\n🪪 | @${msg.from.username || 'no-username'}\n🆔  | ${msg.from.id}\n💬 | ${chatId}\n\nMessage:\n» `;

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

function logCommandLoad(loadedFiles, commands) {
  console.log(COLORS.RED, '────────────── LOAD COMMANDS ──────────────');
  console.log(COLORS.CYAN, `[${timestamp()}] [INFO] Loading commands...`);
  console.log(COLORS.GREEN, `[${timestamp()}] [SUCCESS] Loaded ${commands.size} commands.`);
  console.log(COLORS.CYAN, `[${timestamp()}] Commands: ${loadedFiles.join(', ')}`);
}

function logDbConnection() {
  console.log(COLORS.RED, `────────────── DATABASE CONNECTION ──────────────`);
  console.log(COLORS.CYAN, `[${timestamp()}] [INFO] Connecting to database...`);
  console.log(COLORS.GREEN, `[${timestamp()}] [SUCCESS] Database connected successfully.`);
}

function logBotStartup(port) {
  console.log(COLORS.RED, `────────────── BOT STARTUP ──────────────`);
  console.log(COLORS.GREEN, `[${timestamp()}] [SUCCESS] Bot started successfully : http://localhost:${port}`);
  console.log(COLORS.CYAN, `[${timestamp()}] The bot is now ready to receive messages from users.`);
}

module.exports = { logMessage, processCommand, logCommandLoad, logDbConnection, logBotStartup };

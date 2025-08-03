require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const app = require('./server');
const userModel = require('./DB/User.js');
const connectDb = require('./DB/db.js');
const { checkChannelSubscription, sendSubscriptionPrompt } = require('./utilities/channelUtils.js');
const { logMessage, processCommand, logCommandLoad, logDbConnection, logBotStartup } = require('./log.js');

const port = process.env.PORT || 7777;
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const commands = new Map();
global.commands = commands;

const ERROR_MESSAGES = {
  COMMAND_SYNTAX: "The command syntax is incorrect. Please use %1help %2 for details",
  GENERAL_ERROR: "An error occurred while processing your request",
  DB_ERROR: "Database operation failed",
  NOT_SUBSCRIBED: "You must subscribe to the required channels to use this bot."
};

async function logAndUpdateUser(msg) {
  try {
    await Promise.all([logMessage(msg, bot), handleUserData(msg)]);
  } catch (error) {
    handleError(`Logging or user data update`, error);
  }
}

async function handleUserData(msg) {
  await userModel.findOneAndUpdate(
    { userId: msg.from.id },
    {
      $set: {
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
        username: msg.from.username,
        isBot: msg.from.is_bot,
        lastActivity: new Date()
      },
      $setOnInsert: { joined: new Date() }
    },
    { upsert: true, runValidators: true }
  );
}

function handleError(context, error) {
  console.error(`Error in ${context}:`, error.message || error);
}

function loadCommands() {
  try {
    const commandsDir = path.join(__dirname, 'commands');
    const loadedFiles = [];

    fs.readdirSync(commandsDir).forEach(file => {
      if (!file.endsWith('.js') || file.endsWith('.eg.js')) return;

      const commandPath = path.join(commandsDir, file);
      const command = require(commandPath);
      commands.set(command.name, command);
      loadedFiles.push(file);

      if (command.onStart) {
        bot.onText(new RegExp(`^\\/${command.name}\\b(?:\\s+(.*))?`, 'i'), async (msg, match) => {
          const chatId = msg.chat.id;
          const args = match[1] ? match[1].split(' ') : [];

          await logAndUpdateUser(msg);
          if (!(await checkChannelSubscription(bot, msg.from.id)) && command.category && command.category[0] !== 'Admin') {
            return sendSubscriptionPrompt(bot, chatId);
          }

          try {
            await command.onStart({ bot, msg, args });
          } catch (error) {
            handleError(`Command ${command.name}`, error);
            await bot.sendMessage(chatId, ERROR_MESSAGES.GENERAL_ERROR);
          }
        });
      }
    });

    // Catch unknown /commands and redirect to help
    bot.onText(/\/([^ ]+)/, async (msg, match) => {
      const commandName = match[1].toLowerCase();
      if (commands.has(commandName)) return;

      const chatId = msg.chat.id;
      await logAndUpdateUser(msg);
      if (!(await checkChannelSubscription(bot, msg.from.id))) {
        return sendSubscriptionPrompt(bot, chatId);
      }

      const helpCommand = commands.get('help');
      if (helpCommand?.onChat) {
        try {
          await helpCommand.onChat({ bot, msg, args: match[1].split(' ') });
        } catch (error) {
          handleError(`Help onChat for ${commandName}`, error);
          await bot.sendMessage(chatId, ERROR_MESSAGES.GENERAL_ERROR);
        }
      } else {
        await bot.sendMessage(chatId, `Unknown command: /${commandName}. Try /help for a list of commands.`);
      }
    });

    logCommandLoad(loadedFiles, commands);
  } catch (error) {
    handleError(`Command loading`, error);
    process.exit(1);
  }
}

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  try {
    const [commandName, ...params] = callbackQuery.data.split(':');
    if (commandName === 'check_subscription') {
      const isSubscribed = await checkChannelSubscription(bot, callbackQuery.from.id);
      if (isSubscribed) {
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);
        await bot.sendMessage(chatId, '✅ You are now subscribed to all required channels! You can use the bot.\n\nTo see the list of all commands, type /help.');
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Please join all required channels first.' });
      }
      return;
    }

    const command = commands.get(commandName);
    if (command?.onCallback) {
      await command.onCallback({ bot, callbackQuery, params });
    } else {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Action processed.' });
    }
  } catch (error) {
    handleError(`Callback ${callbackQuery.data}`, error);
    if (chatId) await bot.answerCallbackQuery(callbackQuery.id, { text: ERROR_MESSAGES.GENERAL_ERROR });
  }
});

bot.on('inline_query', async (inlineQuery) => {
  try {
    for (const command of commands.values()) {
      if (command.onInlineQuery) {
        await command.onInlineQuery({ bot, inlineQuery });
      }
    }
  } catch (error) {
    handleError(`Inline query`, error);
    await bot.answerInlineQuery(inlineQuery.id, [], {
      switch_pm_text: 'An error occurred. Try again later.',
      switch_pm_parameter: 'error',
    });
  }
});

bot.on('message', async (msg) => {
  if (msg.from.is_bot || msg.text?.startsWith('/')) return;

  const chatId = msg.chat.id;
  await logAndUpdateUser(msg);
  if (!(await checkChannelSubscription(bot, msg.from.id)) && !commands.get('uploadanime')?.category?.includes('Admin')) {
    return sendSubscriptionPrompt(bot, chatId);
  }

  const text = msg.text?.trim();
  const args = text ? text.split(' ') : [];

  for (const command of commands.values()) {
    if (command.onChat) {
      try {
        await command.onChat({ bot, msg, args });
      } catch (error) {
        handleError(`onChat for ${command.name}`, error);
      }
    }
  }
});

async function main() {
  try {
    await connectDb();
    logDbConnection("Database connected successfully.");
    loadCommands();
    app.listen(port, () => logBotStartup(port));

    const restartTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Dhaka',
      hour12: true,
    });

    await bot.sendMessage(process.env.OWNER_ID, 
      `╔═══•● 𝗦𝗬𝗦𝗧𝗘𝗠 𝗡𝗢𝗧𝗜𝗖𝗘 ●•═══╗

    🔄 𝙏𝙝𝙚 𝘽𝙤𝙩 𝙃𝙖𝙨 𝙍𝙚𝙨𝙩𝙖𝙧𝙩𝙚𝙙
    🕒 𝙏𝙞𝙢𝙚: *${restartTime}*
    📶 𝙎𝙩𝙖𝙩𝙪𝙨: 🟢 𝙊𝙉𝙇𝙄𝙉𝙀\n\n` +
    `╚═══•● 𝗦𝗬𝗦𝗧𝗘𝗠 𝗡𝗢𝗧𝗜𝗖𝗘 ●•═══╝`, { parse_mode: 'Markdown' }
      );

    process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}


main();

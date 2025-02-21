require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const app = require('./server');
const userModel = require('./DB/User.js');
const connectDb = require('./DB/db.js');

const { logMessage, processCommand, logCommandLoad, logDbConnection, logBotStartup } = require('./log.js');

const port = process.env.PORT || 4000;
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const commands = new Map();
global.commands = commands;

const ERROR_MESSAGES = {
  COMMAND_SYNTAX: "The command syntax is incorrect. Please use %1help %2 for details",
  GENERAL_ERROR: "An error occurred while processing your request",
  DB_ERROR: "Database operation failed"
};


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
        bot.onText(new RegExp(`^\\/${command.name}\\b(?:\\s+(.*))?`), async (msg, match) => {
          const chatId = msg.chat.id;
          const args = match[1] ? match[1].split(' ') : [];

          try {
            await command.onStart({ bot, msg, args });
          } catch (error) {
            handleError (`Command ${command.name}`, error);
            await bot.sendMessage(chatId, ERROR_MESSAGES.GENERAL_ERROR);
          }
        });
      }
    });

    logCommandLoad(loadedFiles, commands);
  } catch (error) {
    handleError (`Command loading failed`, error);
    process.exit(1);
  }
}

// DB Handling
async function handleUserData(msg) {
  try {
    const updateData = {
      firstName: msg.from.first_name,
      lastName: msg.from.last_name,
      username: msg.from.username,
      isBot: msg.from.is_bot,
      lastActivity: new Date()
    };

    await userModel.findOneAndUpdate(
      { userId: msg.from.id },
      { $set: updateData, $setOnInsert: { joined: new Date() } },
      { upsert: true, runValidators: true }
    );
  } catch (error) {
    handleError (`User data update error`, error);
    throw new Error(ERROR_MESSAGES.DB_ERROR);
  }
}

// Error handler
function handleError(context, error) {
  const errorMessage = `Error in ${context}:`;
  console.error(errorMessage, error);
  if (error.message in ERROR_MESSAGES) {
    return ERROR_MESSAGES[error.message];
  }
  return ERROR_MESSAGES.GENERAL_ERROR;
}

bot.on('callback_query', async (callbackQuery) => {
  try {
    const [commandName, ...params] = callbackQuery.data.split(':');
    const command = commands.get(commandName);

    if (command && command.onCallback) {
      await command.onCallback({ bot, callbackQuery, params });
    } else {
      await bot.answerCallbackQuery(callbackQuery.id);
    }
  } catch (error) {
    handleError (`Callback error`, error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error processing request' });
  }
});

bot.onText(/\/log (.+)/, (msg, match) => {
  processCommand(msg, bot);
});

bot.on('message', async (msg) => {
  try {
    if (msg.from.is_bot) return;

    await Promise.all([
      logMessage(msg, bot),
      handleUserData(msg)
    ]);

    const text = msg.text?.trim();
    if (!text) return;

    for (const command of commands.values()) {
      if (command.onChat) {
        try {
          await command.onChat({ bot, msg, args: text.split(' ') });
        } catch (error) {
          handleError (`Error in chat handler for command ${command.name}`, error);
        }
      }
    }
  } catch (error) {
    handleError (`Error processing message`, error);
  }
});

async function main() {
  try {
    await connectDb();
    logDbConnection(connectDb)

    loadCommands();

    app.listen(port, () => {
      logBotStartup(port);
    });

    // global error handlers
    process.on('unhandledRejection', (reason) => {
      console.error(`Unhandled Rejection:`, reason);
    });

    process.on('uncaughtException', (error) => {
      console.error(`Uncaught Exception:`, error);
      process.exit(1);
    });
  } catch (error) {
    console.error(`Initialization failed:`, error);
    process.exit(1);
  }
}

// Start the bot
main();

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const app = require('./server');
const userModel = require('./DB/User.js');
const connectDb = require('./DB/db.js');

const port = process.env.PORT || 4000;
const mySecret = process.env['BOT_TOKEN'];
const url = process.env.APP_URL || `https://your-host-name.com`;

const bot = new TelegramBot(mySecret, {
  webHook: {
    port: port
  }
});

bot.setWebHook(`${url}/bot${mySecret}`);

const { logMessage, processCommand } = require('./log.js');

bot.onText(/\/log (.+)/, (msg, match) => {
  processCommand(msg, bot);
});

async function main() {
  try {
    await connectDb();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed", error);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Bot app with webpage listening on port http://localhost:${port}`);
  });
}

main();

async function updateUserModel(msg) {
  try {
    const existingUser = await userModel.findOne({ userId: msg.from.id });

    if (!existingUser) {
      await userModel.findOneAndUpdate(
        { userId: msg.from.id },
        {
          $setOnInsert: {
            firstName: msg.from.first_name,
            lastName: msg.from.last_name,
            isBot: msg.from.is_bot,
            username: msg.from.username,
          },
        },
        { upsert: true, new: true }
      );
      console.log("New User has been added to the database");
    }
  } catch (error) {
    console.error("DB: Error updating user info", error);
    bot.sendMessage(msg.chat.id, "DB: Error updating user info");
  }
}

bot.on('message', async (msg) => {
  try {
    await logMessage(msg, bot);
    await updateUserModel(msg);
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

const callbackListeners = new Map();

bot.on('callback_query', (callbackQuery) => {
  const data = callbackQuery.data;
  for (const [prefix, handler] of callbackListeners) {
    if (data.startsWith(prefix)) {
      handler(callbackQuery);
      break;
    }
  }
});

fs.readdirSync('./commands').forEach((file) => {
  const command = require(`./commands/${file}`);
  command(bot, callbackListeners);
});

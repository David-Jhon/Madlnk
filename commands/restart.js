const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

const ownerId = process.env.OWNER_ID;
const logFilePath = path.join(__dirname, "tmp", "restart.log");

module.exports = {
  name: "restart",
  version: 1.0,
  longDescription: "",
  shortDescription: "Restart the bot.",
  guide: "{pn}",
  category: ['Admin', 99],
  lang: {
    initiating: "🔄 Initiating bot restart... Shutting down...",
    offline: "💤 Bot is now offline. Starting up again...",
    completed: (duration) =>
      `✅ Restart process completed! Time taken: ${duration} seconds. Bot is now online!`,
    error:
      "💔 Oops! Something went wrong during the restart. Please try again later!"
  },
  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (userId.toString() !== ownerId) {
      return;
    }

    const startTime = Date.now();

    try {
      await fs.mkdir(path.dirname(logFilePath), { recursive: true });
      await bot.sendMessage(chatId, module.exports.lang.initiating);

      const shutdownTime = new Date().toISOString();
      await fs.appendFile(logFilePath, `Shutdown initiated: ${shutdownTime}\n`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      await bot.sendMessage(chatId, module.exports.lang.offline);

      const child = spawn(process.argv[0], process.argv.slice(1), {
        detached: true,
        stdio: "inherit"
      });
      child.unref();

      const restartTime = new Date().toISOString();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      await fs.appendFile(
        logFilePath,
        `Restart completed: ${restartTime}\nRestart duration: ${duration} seconds\n\n`
      );

      await bot.sendMessage(chatId, module.exports.lang.completed(duration));

      process.exit();
    } catch (error) {
      console.error("Error during restart:", error);
      await bot.sendMessage(chatId, module.exports.lang.error);
    }
  },
};

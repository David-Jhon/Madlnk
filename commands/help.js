const fs = require("fs");
const path = require("path");

module.exports = {
  name: "help",
  version: 1.0,
  longDescription: "View detailed command usages",
  shortDescription: "Display the help menu",
  guide: "{pn} | [[<commandName>]]",
  category: ["Getting Started", 1],
  lang: {
    usage: "Usage: /help [commandName]",
    error: "An error occurred while generating help information.",
    notFound: "No command found with that name, type /help to see all available commands",
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    try {
      const botInfo = await bot.getMe();
      let botName = botInfo.first_name.includes("Bot") ? botInfo.first_name : `${botInfo.first_name} Bot`;

      const isAdmin = msg.from.id.toString() === process.env.OWNER_ID;
      const ignoreCommands = ["channel.js"];

      const commandsDir = path.join(__dirname, "../commands");
      const commandFiles = fs
        .readdirSync(commandsDir)
        .filter((file) => file.endsWith(".js") && !file.endsWith("eg.js") && !ignoreCommands.includes(file));

      const commands = [];
      for (const file of commandFiles) {
        const command = require(path.join(commandsDir, file));
        if (command.ignoreCommand) continue;
        if (Array.isArray(command.category) && command.category[0].toLowerCase() === "admin" && !isAdmin) continue;

        commands.push(command);
      }

      const replacePlaceholder = (str, name) => str.replace(/{pn}/g, `/${name}`);

      if (args && args.length > 0) {
        const query = args[0].toLowerCase();
        const found = commands.find((cmd) => cmd.name.toLowerCase() === query);
        if (!found) {
          return bot.sendMessage(chatId, module.exports.lang.notFound, { parse_mode: "Markdown" });
        }

        const guide = found.guide ? replacePlaceholder(found.guide, found.name) : "";
        const detailedMessage = `─── NAME ────⭓\n` +
          `» ${found.name}\n` +
          `─── INFO\n\n` +
          `» Description: ${found.longDescription}\n` +
          `─── Guide\n${guide}\n` +
          `───────✧`;
        return bot.sendMessage(chatId, detailedMessage, { parse_mode: "Markdown" });
      }

      const grouped = {};
      commands.forEach((cmd) => {
        let categoryName, order;
        if (Array.isArray(cmd.category)) {
          [categoryName, order] = cmd.category;
        } else {
          categoryName = cmd.category || "Other";
          order = Number.MAX_SAFE_INTEGER;
        }
        if (!grouped[categoryName]) {
          grouped[categoryName] = { order, commands: [] };
        }
        grouped[categoryName].commands.push(cmd);
      });

      const sortedCategories = Object.keys(grouped)
        .map((name) => ({ name, order: grouped[name].order, commands: grouped[name].commands }))
        .sort((a, b) => a.order - b.order);


      let helpMessage = `*Welcome to* \`${botName}\`*! 🤖*\n\n*Available Commands:*\n`;
      sortedCategories.forEach((cat) => {
        if (cat.commands.length === 0) return;
        helpMessage += `\n*${cat.name}*\n`;
        cat.commands
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((cmd) => {
            helpMessage += `• */${cmd.name}* - ${cmd.shortDescription}\n`;
          });
      });
      helpMessage += `\n\nType [[/help <commandName>]] to view detailed information about a specific command.\n`;

      await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error generating help message:", error);
      await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: "Markdown" });
    }
  },

  onChat: async ({ bot, msg, args }) => {
    if (msg.text && msg.text.startsWith("/")) {
      const inputCmd = msg.text.split(" ")[0].substring(1).toLowerCase();
      if (!global.commands || !global.commands.has(inputCmd)) {
        await bot.sendMessage(msg.chat.id, "The command you are using doesn't exist, type /help to see all available commands", { parse_mode: "Markdown" });
      }
    }
  },
};

// commands/start.js
const AnimeCommand = require('./anime.js');

module.exports = {
  name: 'start',
  version: 1.0,
  longDescription: 'Start interacting with the bot.',
  shortDescription: 'Get started with Bot',
  guide: '{pn} [payload]',
  category: ['Getting Started', 1],

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    if (args && args.length > 0) {
      const payload = args[0].replace(/-/g, '+').replace(/_/g, '/');
      try {
        const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
        const [type] = decodedPayload.split('-');

        if (type === 'anime' && AnimeCommand.onStartDeepLink) {
          await AnimeCommand.onStartDeepLink({ bot, msg, payload });
          return;
        }

        await bot.sendMessage(chatId, 'Invalid action.', { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error processing deep link:', error);
        await bot.sendMessage(chatId, 'An error occurred while processing the deep link.', { parse_mode: 'Markdown' });
      }
      return;
    }

    await bot.sendMessage(
      chatId,
      `Hey there! \`${msg.from.first_name}\` 😃 \n\n𝗜'𝗺 𝗮 𝗠𝗔𝗗 𝗯𝗼𝘁. I can help you find anime, manga, manhwa, manhua. \nTo see the list of all commands, type /help.`,
      { parse_mode: 'Markdown' }
    );
  },
};

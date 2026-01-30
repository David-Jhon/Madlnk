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
      const payload = args[0];

      if (payload.startsWith('join_anime_id_')) {
        const id = payload.replace('join_anime_id_', '');
        const animeChannelId = process.env.ANIME_CHANNEL_ID;
        try {
          await bot.forwardMessage(chatId, animeChannelId, id);
        } catch (error) {
          console.error(`Error forwarding anime message ${id}:`, error);
          await bot.sendMessage(chatId, 'Sorry, I couldn’t find the anime. 😕', { parse_mode: 'Markdown' });
        }
        return;
      }

      if (payload.startsWith('join_manga_id_')) {
        const id = payload.replace('join_manga_id_', '');
        const mangaChannelId = process.env.MANGA_CHANNEL_ID;
        try {
          await bot.forwardMessage(chatId, mangaChannelId, id);
        } catch (error) {
          console.error(`Error forwarding manga message ${id}:`, error);
          await bot.sendMessage(chatId, 'Sorry, I couldn’t find the manga. 😕', { parse_mode: 'Markdown' });
        }
        return;
      }

      try {
        const decodedPayload = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

        // Handle genlink-generated links
        if (decodedPayload.startsWith('get-')) {
          const parts = decodedPayload.replace('get-', '').split('-');
          const storageGroupId = parseInt(process.env.STORAGE_GROUP_ID);

          try {
            if (parts.length === 1) {
              // Single message
              const msgId = Math.floor(parseInt(parts[0]) / Math.abs(storageGroupId));
              await bot.copyMessage(chatId, storageGroupId, msgId);
              return;

            } else if (parts.length === 2) {
              // Batch messages
              const firstId = Math.floor(parseInt(parts[0]) / Math.abs(storageGroupId));
              const lastId = Math.floor(parseInt(parts[1]) / Math.abs(storageGroupId));

              for (let i = firstId; i <= lastId; i++) {
                try {
                  await bot.copyMessage(chatId, storageGroupId, i);
                } catch (error) {
                  console.error(`Error copying message ${i}:`, error);
                  // Continue with next message even if one fails
                }
              }
              return;
            }
          } catch (error) {
            console.error('Error processing genlink:', error);
            await bot.sendMessage(chatId, '❌ Unable to retrieve the requested content. The link may be invalid or expired.', { parse_mode: 'Markdown' });
            return;
          }
        }

        // Handle existing deep link types
        const [type] = decodedPayload.split('-');
        if (type === 'anime' && AnimeCommand.onStartDeepLink) {
          await AnimeCommand.onStartDeepLink({ bot, msg, payload });
          return;
        }
        await bot.sendMessage(chatId, 'Invalid action.', { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error processing deep link:', error);
        await bot.sendMessage(chatId, 'An error occurred while processing.', { parse_mode: 'Markdown' });
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
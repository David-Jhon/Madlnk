const db = require('../DB/sqlite.js');
const crypto = require('crypto');

module.exports = {
  name: 'anime',
  version: 1.0,
  longDescription: 'Generate a link to receive episodes of a specified anime.',
  shortDescription: 'Get anime episodes',
  guide: '{pn} <animeName>\nExamples:\n/anime Bocchi the Rock\n/anime Naruto Season 1',
  category: ['Download', 4],
  lang: {
    usage: 'Usage: /anime <animeName>\nEx: /anime Bocchi the Rock 🎸\nEx: /anime Naruto Season 1 🥷',
    error: '❌ Oops! An error occurred. Try again later. 😞',
    notFound: '😕 No episodes found for the specified anime.\n\n Use the command /list to see the available anime',
    singleResult: '🎬 Found results for query ★{animeName}★\n\n➤ Click below to get all episodes! ✅',
    multipleResults: '🎥 Found results for query ★{baseName}★\n\n➤ Click below for episodes! ✅',
    sending: '📤 Sending episodes for:\n\n★ `{animeName}` ★... ⏳\n» `1080p [English + Japanese]`',
    sent: '✅ All episodes for ★{animeName}★ sent! 🎉\n\n💾 *Forward to a private chat or save to "Saved Messages"*.\n\n🚨] » *Files will be deleted in 15 mins!*...Due to Copyright Issues 🕒',
    deleted: '🚨 ★ *Files Deleted* ★ 🚨\n\n📜 » *Your files have been removed to comply with copyright laws.* 🗑️\n⚖️ » *Thank you for understanding!*\n═══════ ⋆★⋆ ═══════',
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
        if (!args?.length) return bot.sendMessage(chatId, module.exports.lang.usage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: "🔍 Search Anime",
                        switch_inline_query_current_chat: "anime:"
                    }],
                ],
            },
        });

    const animeName = args.join(' ').toLowerCase().replace(/\s+/g, '_');
    const baseDisplayName = animeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/ .*/, '');
    const animes = await db.searchAnimeByName(animeName).catch(() => []);

    if (!animes.length) return bot.sendMessage(chatId, module.exports.lang.notFound, {
      parse_mode: 'Markdown',
      reply_markup: {
          inline_keyboard: [
              [{
                  text: "🔍 Search Anime",
                  switch_inline_query_current_chat: "anime:"
              }],
          ]
      }
  });

    const botUsername = (await bot.getMe()).username;
    const inlineKeyboard = animes.map(anime => {
      const displayName = anime.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const encodedAnimeName = Buffer.from(anime.name).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 22);
      const payload = `anime-${anime.animeId}-${encodedAnimeName}`;
      const encodedPayload = Buffer.from(payload).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      const deepLink = `https://t.me/${botUsername}?start=${encodedPayload}`;
      return [{ text: `🎬 ${displayName}`, url: deepLink }];
    });

    const message = animes.length === 1
      ? module.exports.lang.singleResult.replace('{animeName}', baseDisplayName)
      : module.exports.lang.multipleResults.replace('{baseName}', baseDisplayName).replace('{buttons}', inlineKeyboard.map(b => b[0].text).join('\n➤ '));
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: inlineKeyboard } });
  },

  onStartDeepLink: async ({ bot, msg, payload }) => {
    const chatId = msg.chat.id;
    const messageIdsToDelete = [];

    try {
      const [type, animeId, encodedAnimeName] = Buffer.from(payload, 'base64').toString('utf8').split('-');
      if (type !== 'anime') {
        const errorMsg = await bot.sendMessage(chatId, 'Invalid link. ❌', { parse_mode: 'Markdown' });
        messageIdsToDelete.push(errorMsg.message_id);
        return;
      }

      const anime = await db.getAnimeById(animeId);
      if (!anime || !JSON.parse(anime.episodes).length) {
        const notFoundMsg = await bot.sendMessage(chatId, module.exports.lang.notFound, { parse_mode: 'Markdown' });
        messageIdsToDelete.push(notFoundMsg.message_id);
        return;
      }

      const displayName = anime.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const sendingMsg = await bot.sendMessage(chatId, module.exports.lang.sending.replace('{animeName}', displayName), { parse_mode: 'Markdown' });
      messageIdsToDelete.push(sendingMsg.message_id);

      const episodes = JSON.parse(anime.episodes).sort((a, b) => a.episodeNumber - b.episodeNumber);
      for (const episode of episodes) {
        const caption = `Name: ${displayName}\nEp: ${episode.episodeNumber.toString().padStart(3, '0')}\nQuality: 1080p`;
        const sentEpisode = await bot.copyMessage(chatId, process.env.STORAGE_GROUP_ID, episode.messageId, {
          caption,
          parse_mode: 'Markdown',
          disable_notification: true,
        });
        messageIdsToDelete.push(sentEpisode.message_id);
        await new Promise(resolve => setTimeout(resolve, 3500));
      }

      const stickerMsg = await bot.sendMessage(chatId, '🎶 ━━━━━━━━━━━━━━━━━━ 🎶', { parse_mode: 'Markdown' });
      messageIdsToDelete.push(stickerMsg.message_id);

      const sentMsg = await bot.sendMessage(chatId, module.exports.lang.sent.replace('{animeName}', displayName), { parse_mode: 'Markdown' });
      messageIdsToDelete.push(sentMsg.message_id);

      setTimeout(async () => {
        for (const messageId of messageIdsToDelete) {
          try {
            await bot.deleteMessage(chatId, messageId);
          } catch (deleteError) {
            console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, deleteError);
          }
        }
        await bot.sendMessage(chatId, module.exports.lang.deleted, { parse_mode: 'Markdown' });
      }, 900000);
    } catch (error) {
      console.error('Deep link error:', error);
      const errorMsg = await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: 'Markdown' });
      messageIdsToDelete.push(errorMsg.message_id);

      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, errorMsg.message_id);
        } catch (deleteError) {
          console.error(`Failed to delete error message ${errorMsg.message_id} in chat ${chatId}:`, deleteError);
        }
      }, 900000);
    }
  },

  onInlineQuery: async ({ bot, inlineQuery }) => {
    const query = inlineQuery.query.trim().toLowerCase();
    if (!query.startsWith('anime:')) return;

    const searchTerm = query.replace('anime:', '').trim();
    let animes = [];

    try {
      animes = searchTerm
        ? await db.searchAnimeByName(searchTerm).catch(err => {
            console.error('Search error:', err); // Debug: Log search errors
            return [];
          })
        : await db.getAllAnimes().catch(err => {
            console.error('Get all error:', err); // Debug: Log get all errors
            return [];
          });

      if (!animes.length) {
        await bot.answerInlineQuery(inlineQuery.id, [], {
          switch_pm_text: 'No anime found.',
          switch_pm_parameter: 'uploadanime',
        });
        return;
      }

      const results = animes.map((anime, index) => {
        const displayName = anime.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const episodes = JSON.parse(anime.episodes || '[]');
        const totalEpisodes = episodes.length;
        const description = `Total EP: ${totalEpisodes} || Quality: 1080p [English + Japanese]`;
        return {
          type: 'Article',
          id: `${anime.animeId}-${index}`,
          title: displayName,
          description: description,
          input_message_content: {
            message_text: `/anime ${displayName}`,
            parse_mode: 'Markdown',
          },
        };
      });

      await bot.answerInlineQuery(inlineQuery.id, results, {
        cache_time: 300,
      });
    } catch (error) {
      console.error('Inline query error:', error); // Debug: Catch any unhandled errors
    }
  },
};

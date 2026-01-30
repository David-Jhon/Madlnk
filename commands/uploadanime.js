const db = require('../DB/sqlite.js');
const crypto = require('crypto');

module.exports = {
  name: 'uploadanime',
  version: 1.0,
  longDescription: 'Upload anime episodes to the storage group and store metadata in the database (admin only).',
  shortDescription: 'Upload anime episodes',
  guide: '{pn} <animeName> [--movie]',
  category: ['Admin', 99],
  lang: {
    usage: 'ᴜsᴀɢᴇ: /ᴜᴘʟᴏᴀᴅᴀɴɪᴍᴇ <ᴀɴɪᴍᴇɴᴀᴍᴇ> [--ᴍᴏᴠɪᴇ]\n\nᴇxᴀᴍᴘʟᴇs:\n\n/ᴜᴘʟᴏᴀᴅᴀɴɪᴍᴇ ʙᴏᴄᴄʜɪ ᴛʜᴇ ʀᴏᴄᴋ\n/ᴜᴘʟᴏᴀᴅᴀɴɪᴍᴇ ɴᴀʀᴜᴛᴏ sᴇᴀsᴏɴ 1\n/ᴜᴘʟᴏᴀᴅᴀɴɪᴍᴇ ᴊᴜᴊᴜᴛsᴜ ᴋᴀɪsᴇɴ 0 --ᴍᴏᴠɪᴇ\n\nsᴇɴᴅ ᴇᴘɪsᴏᴅᴇ ꜰɪʟᴇs ᴛᴏ ᴛʜᴇ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ ᴀɴᴅ ᴄʟɪᴄᴋ "ᴅᴏɴᴇ" ᴛᴏ ꜰɪɴɪsʜ ᴏʀ "ᴄᴀɴᴄᴇʟ" ᴛᴏ ᴀʙᴏʀᴛ.',
    error: 'ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴜᴘʟᴏᴀᴅɪɴɢ ᴇᴘɪsᴏᴅᴇs. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.',
    success: 'sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴇᴘɪsᴏᴅᴇs ꜰᴏʀ *{animeName}*!',
    adminOnly: 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ʀᴇsᴛʀɪᴄᴛᴇᴅ ᴛᴏ ᴀᴅᴍɪɴs ᴏɴʟʏ.',
    startUpload: 'ᴜᴘʟᴏᴀᴅ sᴇssɪᴏɴ sᴛᴀʀᴛᴇᴅ ꜰᴏʀ:\n*{animeName}*\n\nᴘʟᴇᴀsᴇ sᴇɴᴅ ᴇᴘɪsᴏᴅᴇ ꜰɪʟᴇs ᴛᴏ ᴛʜᴇ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ ᴀɴᴅ ᴜsᴇ "ᴅᴏɴᴇ" ᴛᴏ ꜰɪɴɪsʜ ᴏʀ "ᴄᴀɴᴄᴇʟ" ᴛᴏ ᴀʙᴏʀᴛ.',
    fileReceived: 'ʀᴇᴄᴇɪᴠᴇᴅ ᴇᴘɪsᴏᴅᴇ {episodeNumber} ꜰᴏʀ *{animeName}*',
    canceled: 'ᴜᴘʟᴏᴀᴅ sᴇssɪᴏɴ ꜰᴏʀ *{animeName}* ʜᴀs ʙᴇᴇɴ ᴄᴀɴᴄᴇʟᴇᴅ.',
    notInGroup: 'ᴘʟᴇᴀsᴇ sᴇɴᴅ ᴇᴘɪsᴏᴅᴇ ꜰɪʟᴇs ɪɴ ᴛʜᴇ ᴅᴇsɪɢɴᴀᴛᴇᴅ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ.',
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    if (msg.from.id.toString() !== process.env.OWNER_ID) {
      return
    }

    if (args.length < 1) {
      return bot.sendMessage(chatId, module.exports.lang.usage, { parse_mode: 'Markdown' });
    }

    if (!process.env.STORAGE_GROUP_ID) {
      console.error('STORAGE_GROUP_ID is not set in .env');
      return bot.sendMessage(chatId, 'ᴇʀʀᴏʀ: sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ ɪᴅ ɪs ɴᴏᴛ ᴄᴏɴꜰɪɢᴜʀᴇᴅ.', { parse_mode: 'Markdown' });
    }

    const isMovie = args.includes('--movie');
    const nameArgs = args.filter(arg => arg !== '--movie');
    const animeName = nameArgs.join(' ').trim().toLowerCase().replace(/\\s+/g, '_');

    if (!animeName) {
      return bot.sendMessage(chatId, module.exports.lang.usage, { parse_mode: 'Markdown' });
    }

    global.uploadAnime = {
      animeName,
      isMovie,
      adminId: msg.from.id,
      storageGroupId: process.env.STORAGE_GROUP_ID.toString(),
      episodes: [],
      existingEpisodes: [],
    };

    const existingAnime = await db.getAnimeByName(animeName);
    if (existingAnime) {
      global.uploadAnime.existingEpisodes = JSON.parse(existingAnime.episodes);
      global.uploadAnime.animeId = existingAnime.animeId;
    } else {
      global.uploadAnime.animeId = crypto.randomBytes(8).toString('hex');
    }

    const displayName = animeName.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
    const message = module.exports.lang.startUpload
      .replace('{animeName}', displayName);

    const sentMessage = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ ᴅᴏɴᴇ', callback_data: 'uploadanime:done' }],
          [{ text: '❌ ᴄᴀɴᴄᴇʟ', callback_data: 'uploadanime:cancel' }]
        ]
      }
    });

    global.uploadAnime.messageId = sentMessage.message_id;
    global.uploadAnime.chatId = chatId;
  },

  onChat: async ({ bot, msg }) => {
    if (!global.uploadAnime) {
      return;
    }

    const chatId = msg.chat.id;

    if (msg.document || msg.video) {
      const chatIdStr = chatId.toString();
      const storageGroupIdStr = global.uploadAnime.storageGroupId.toString();

      if (chatIdStr !== storageGroupIdStr) {
        const message = module.exports.lang.notInGroup.replace('{groupId}', global.uploadAnime.storageGroupId);
        await bot.sendMessage(msg.from.id, message, { parse_mode: 'Markdown' });
        return;
      }

      const fileId = msg.document?.file_id || msg.video?.file_id;
      const episodeNumber = global.uploadAnime.existingEpisodes.length + global.uploadAnime.episodes.length + 1;

      global.uploadAnime.episodes.push({
        episodeNumber,
        fileId,
        messageId: msg.message_id,
      });

      const displayName = global.uploadAnime.animeName.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
      const message = module.exports.lang.fileReceived
        .replace('{episodeNumber}', episodeNumber)
        .replace('{animeName}', displayName);

      // Edit the original message (M1) with updated caption
      await bot.editMessageText(message, {
        chat_id: global.uploadAnime.chatId,
        message_id: global.uploadAnime.messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ ᴅᴏɴᴇ', callback_data: 'uploadanime:done' }],
            [{ text: '❌ ᴄᴀɴᴄᴇʟ', callback_data: 'uploadanime:cancel' }]
          ]
        }
      });
    }
  },

  onCallback: async ({ bot, callbackQuery, params }) => {
    if (!global.uploadAnime) {
      return;
    }

    const action = params[0];
    const chatId = callbackQuery.message.chat.id;

    if (action === 'done') {
      const { animeName, animeId, isMovie, episodes, existingEpisodes } = global.uploadAnime;

      if (episodes.length === 0 && existingEpisodes.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'No episodes were uploaded.', show_alert: true });
        await bot.deleteMessage(chatId, global.uploadAnime.messageId);
        delete global.uploadAnime;
        return;
      }

      try {
        const allEpisodes = [...existingEpisodes, ...episodes];
        await db.saveAnime(animeId, animeName, null, allEpisodes, isMovie);

        const displayName = animeName.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
        const message = module.exports.lang.success
          .replace('{animeName}', displayName);

        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Upload completed!', show_alert: false });
        await bot.deleteMessage(chatId, global.uploadAnime.messageId);
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        delete global.uploadAnime;
      } catch (error) {
        console.error('Error saving anime:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error occurred!', show_alert: true });
        await bot.deleteMessage(chatId, global.uploadAnime.messageId);
        await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: 'Markdown' });
        delete global.uploadAnime;
      }
    } else if (action === 'cancel') {
      const displayName = global.uploadAnime.animeName.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
      const message = module.exports.lang.canceled
        .replace('{animeName}', displayName);

      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Upload canceled!', show_alert: false });
      await bot.deleteMessage(chatId, global.uploadAnime.messageId);
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      delete global.uploadAnime;
    }
  },
};
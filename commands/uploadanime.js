const db = require('../DB/sqlite.js');
const crypto = require('crypto');

module.exports = {
  name: 'uploadanime',
  version: 1.0,
  longDescription: 'Upload anime episodes to the storage group and store metadata in the database (admin only).',
  shortDescription: 'Upload anime episodes',
  guide: '{pn} <animeName>\nExamples:\n/uploadanime Bocchi the Rock\n/uploadanime Naruto Season 1\nSend episode files in the storage group, then use "done" or "cancel" to finish or abort.',
  category: ['Admin', 99],
  lang: {
    usage: 'Usage: /uploadanime <animeName>\nExamples:\n/uploadanime Bocchi the Rock\n/uploadanime Naruto Season 1\nSend episode files in the storage group, then use "done" or "cancel".',
    error: 'An error occurred while uploading episodes. Please try again.',
    success: 'Successfully uploaded episodes for *{animeName}*!',
    adminOnly: 'This command is restricted to admins only.',
    startUpload: 'Upload session started for *{animeName}*. Please send episode files to the storage group and use "done" to finish or "cancel" to abort.',
    fileReceived: 'Received episode {episodeNumber} for *{animeName}*. Send the next file or use "done".',
    canceled: 'Upload session for *{animeName}* has been canceled.',
    notInGroup: 'Please send episode files in the designated storage group.',
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
      return bot.sendMessage(chatId, 'Error: Storage group ID is not configured.', { parse_mode: 'Markdown' });
    }

    const animeName = args.join(' ').trim().toLowerCase().replace(/\s+/g, '_');

    if (!animeName) {
      return bot.sendMessage(chatId, module.exports.lang.usage, { parse_mode: 'Markdown' });
    }

    global.uploadAnime = {
      animeName,
      adminId: msg.from.id,
      storageGroupId: process.env.STORAGE_GROUP_ID.toString(),
      episodes: [],
      existingEpisodes: [],
    };

    const existingAnime = await db.getAnimeByName(animeName); // Adjusted to use full name
    if (existingAnime) {
      global.uploadAnime.existingEpisodes = JSON.parse(existingAnime.episodes);
      global.uploadAnime.animeId = existingAnime.animeId;
    } else {
      global.uploadAnime.animeId = crypto.randomBytes(8).toString('hex');
    }

    const displayName = animeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const message = module.exports.lang.startUpload
      .replace('{animeName}', displayName);
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  },

  onChat: async ({ bot, msg }) => {
    const authorizedAdmins = [process.env.OWNER_ID, '6553738238'];
if (!global.uploadAnime || !authorizedAdmins.includes(msg.from.id.toString())) {
  return;
}

    const chatId = msg.chat.id;

    if (msg.text && msg.text.toLowerCase() === 'done') {
      const { animeName, animeId, episodes, existingEpisodes } = global.uploadAnime;

      if (episodes.length === 0 && existingEpisodes.length === 0) {
        await bot.sendMessage(chatId, 'No episodes were uploaded.', { parse_mode: 'Markdown' });
        delete global.uploadAnime;
        return;
      }

      try {
        const allEpisodes = [...existingEpisodes, ...episodes];
        await db.saveAnime(animeId, animeName, null, allEpisodes); // Pass null for part

        const displayName = animeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const message = module.exports.lang.success
          .replace('{animeName}', displayName);
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        delete global.uploadAnime;
      } catch (error) {
        console.error('Error saving anime:', error);
        await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: 'Markdown' });
        delete global.uploadAnime;
      }
    } else if (msg.text && msg.text.toLowerCase() === 'cancel') {
      const displayName = global.uploadAnime.animeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const message = module.exports.lang.canceled
        .replace('{animeName}', displayName);
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      delete global.uploadAnime;
    } else if (msg.document || msg.video) {
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

      const displayName = global.uploadAnime.animeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const message = module.exports.lang.fileReceived
        .replace('{episodeNumber}', episodeNumber)
        .replace('{animeName}', displayName);
      await bot.sendMessage(msg.from.id, message, { parse_mode: 'Markdown' });
    }
  },
};

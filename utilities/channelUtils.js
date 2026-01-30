const requiredChannels = [
  { id: process.env.MANGA_CHANNEL_ID, name: 'Channel 1', inviteLink: process.env.MANGA_CHANNEL_LINK },
  { id: process.env.ANIME_CHANNEL_ID, name: 'Channel 2', inviteLink: process.env.ANIME_CHANNEL_LINK }
];

const photoFileId = 'https://i.ibb.co.com/XxC2vc7P/Picsart-25-08-29-18-55-12-288.jpg';
// const photoFileId = 'AgACAgUAAyEFAASoSw2rAAMEaGmjSVf6xecJb8YigW-rHW6MKvMAAi3AMRt2MAFVnlX1_EUTMokBAAMCAAN5AAM2BA';

async function checkChannelSubscription(bot, userId) {
  try {
    const checks = await Promise.all(
      requiredChannels.map(async (channel) => {
        const chatMember = await bot.getChatMember(channel.id, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
      })
    );
    return checks.every(subscribed => subscribed);
  } catch (error) {
    console.error('Error checking channel subscription:', error.message);
    return false;
  }
}

async function sendSubscriptionPrompt(bot, chatId) {
  const message = `⚠️ To use this bot, you must subscribe to the following channels. 📢\n\nAfter joining, click "Try Again" to proceed. 🚀`;

  const inlineKeyboard = [
    requiredChannels.map(ch => ({ text: `Join ${ch.name} 🌟`, url: ch.inviteLink })),
    [{ text: 'Try Again ✅', callback_data: 'check_subscription' }],
  ];

  try {
    // Attempt to send the photo
    await bot.sendPhoto(chatId, photoFileId, {
      caption: message,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  } catch (error) {
    console.error('Error sending photo in sendSubscriptionPrompt:', error.message);
    // Fallback to text-only message if photo fails
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }
}

module.exports = { checkChannelSubscription, sendSubscriptionPrompt, requiredChannels };

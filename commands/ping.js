
module.exports = function (bot) {
bot.onText(/\/ping/, (msg) => {
  const chatId = msg.chat.id;
  const start = Date.now();

  bot.sendMessage(chatId, '🏓 Pinging...').then(sent => {
    const end = Date.now();
    const ping = end - start;

    bot.editMessageText(`🎉 _MADBot Pong!!!_\n\`Ping: ${ping} ms\``, {
      chat_id: sent.chat.id,
      message_id: sent.message_id,
      parse_mode: 'Markdown'
    });
  });
});
}

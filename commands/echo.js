module.exports = function (bot) {
  bot.on('message', (msg) => {
    if (msg.text.startsWith('/echo')) {
      const echoText = msg.text.replace('/echo', '').trim();
      bot.sendMessage(msg.chat.id, echoText, { parse_mode: 'Markdown',                       disable_web_page_preview: true });
    }
  });
};
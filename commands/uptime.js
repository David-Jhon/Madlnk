const os = require('os');

module.exports = function (bot) {
  bot.onText(/\/uptime/, async (msg) => {
    const chatId = msg.chat.id;
    const start = Date.now();
    const sentMessage = await bot.sendMessage(chatId, '🔄 Loading...');

    try {
      const systemUptime = os.uptime();
      const botUptime = process.uptime();

      const formatUptime = (uptime) => {
        const days = Math.floor(uptime / (3600 * 24));
        const hours = Math.floor((uptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        return { days, hours, minutes, seconds };
      };

      const systemUp = formatUptime(systemUptime);
      const botUp = formatUptime(botUptime);

      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercentage = (usedMemory / totalMemory * 100).toFixed(2);

      const cpuCores = os.cpus().length;
      const cpuModel = os.cpus()[0].model;

      const nodeVersion = process.version;
      const platform = os.platform();

      const end = Date.now();
      const ping = end - start;

      const messageContent =
        `🖥️ *System Statistics:*\n\n` +
        `• System Uptime: ${systemUp.days}d ${systemUp.hours}h ${systemUp.minutes}m ${systemUp.seconds}s\n` +
        `• Bot Uptime: ${botUp.days}d ${botUp.hours}h ${botUp.minutes}m ${botUp.seconds}s\n` +
        `• Total Memory: ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n` +
        `• Free Memory: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n` +
        `• Memory Usage: ${(usedMemory / 1024 ** 2).toFixed(2)} MB\n` +
        `• Memory Usage Percentage: ${memoryUsagePercentage}%\n` +
        `• CPU Cores: ${cpuCores}\n` +
        `• CPU Model: ${cpuModel}\n` +
        `• Node.js Version: ${nodeVersion}\n` +
        `• Platform: ${platform}\n` +
        `• Ping: \`${ping}ms\``;

      bot.editMessageText(messageContent, {
        chat_id: sentMessage.chat.id,
        message_id: sentMessage.message_id,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.error(err);
      bot.editMessageText('❌ An error occurred while fetching system statistics.', {
        chat_id: sentMessage.chat.id,
        message_id: sentMessage.message_id,
      });
    }
  });
};

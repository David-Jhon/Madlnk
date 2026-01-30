const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const bot = req.app.locals.bot;
        const commands = req.app.locals.bot.commands;
        const { requiredChannels } = require('../utilities/channelUtils');

        const botInfo = await bot.getMe();

        const loadedCommands = Array.from(commands.values()).map(cmd => ({
            name: cmd.name,
            description: cmd.shortDescription || cmd.longDescription || 'No description',
            category: Array.isArray(cmd.category) ? cmd.category[0] : (cmd.category || 'N/A')
        }));

        const channels = requiredChannels.map(channel => ({
            id: channel.id,
            title: channel.name
        }));

        res.json({
            botInfo: {
                id: botInfo.id,
                username: botInfo.username,
                firstName: botInfo.first_name,
                isBot: botInfo.is_bot
            },
            loadedCommands,
            requiredChannels: channels
        });

    } catch (error) {
        console.error('Error fetching settings data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/ping', async (req, res) => {
    try {
        const bot = req.app.locals.bot;
        const startTime = Date.now();
        await bot.getMe();
        const endTime = Date.now();
        const latency = endTime - startTime;

        res.json({ latency: `${latency} ms` });
    } catch (error) {
        console.error('Error checking bot latency:', error);
        res.status(500).json({ error: 'Failed to check latency' });
    }
});

module.exports = router;

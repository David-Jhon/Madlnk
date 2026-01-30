const express = require('express');
const router = express.Router();
const userModel = require('../DB/User.js');

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const filter = req.query.filter || 'all';
        const sort = req.query.sort || 'joined';

        const query = {};

        // Search
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter
        if (filter === 'active') {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.lastActivity = { $gte: oneDayAgo };
        } else if (filter === 'blocked') {
            query.isBlocked = true;
        }

        // Sort
        let sortOption = { joined: -1 };
        if (sort === 'activity') {
            sortOption = { lastActivity: -1 };
        }

        const total = await userModel.countDocuments(query);
        const users = await userModel.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit)
            .select('firstName lastName username joined lastActivity isBlocked userId');

        res.json({
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Block/Unblock User
router.post('/:id/block', async (req, res) => {
    try {
        const user = await userModel.findOne({ userId: req.params.id });
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Send Message
router.post('/:id/message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const bot = req.app.locals.bot;
        if (!bot) {
            console.error('Bot instance not found');
            return res.status(500).json({ error: 'Bot service unavailable' });
        }

        await bot.sendMessage(req.params.id, message);
        console.log(`Sent message to ${req.params.id}: ${message}`);

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;

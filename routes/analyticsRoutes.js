const express = require('express');
const router = express.Router();
const User = require('../DB/User.js');
const CommandLog = require('../DB/CommandLog.js');

// Helper function to calculate percentage change
const calculateChange = (current, previous) => {
    if (previous === 0) {
        return current > 0 ? 100 : 0; // If previous is 0, any increase is a 100% increase
    }
    return ((current - previous) / previous) * 100;
};

router.get('/', async (req, res) => {
    try {
        const periodDays = req.query.period === '7d' ? 7 : 30;

        // Define date ranges
        const currentPeriodEnd = new Date();
        const currentPeriodStart = new Date();
        currentPeriodStart.setDate(currentPeriodStart.getDate() - periodDays);

        const previousPeriodEnd = new Date(currentPeriodStart);
        const previousPeriodStart = new Date();
        previousPeriodStart.setDate(previousPeriodStart.getDate() - (periodDays * 2));

        // --- Perform all DB queries in parallel ---
        const [
            totalUsers,
            newUsersCurrent,
            newUsersPrevious,
            activeUsersCurrent,
            activeUsersPrevious,
            messagesCurrent,
            messagesPrevious,
            userGrowth,
            topCommands
        ] = await Promise.all([
            User.countDocuments({ isBot: false }),
            User.countDocuments({ isBot: false, joined: { $gte: currentPeriodStart } }),
            User.countDocuments({ isBot: false, joined: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
            User.countDocuments({ isBot: false, lastActivity: { $gte: currentPeriodStart } }),
            User.countDocuments({ isBot: false, lastActivity: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
            CommandLog.countDocuments({ timestamp: { $gte: currentPeriodStart } }),
            CommandLog.countDocuments({ timestamp: { $gte: previousPeriodStart, $lt: currentPeriodStart } }),
            User.aggregate([
                { $match: { isBot: false, joined: { $gte: currentPeriodStart } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$joined" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: "$_id", count: 1 } }
            ]),
            CommandLog.aggregate([
                { $match: { timestamp: { $gte: currentPeriodStart } } },
                { $group: { _id: "$commandName", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $project: { _id: 0, command: "$_id", count: 1 } }
            ])
        ]);

        // --- Calculate KPIs ---
        const avgCommandsCurrent = activeUsersCurrent > 0 ? messagesCurrent / activeUsersCurrent : 0;
        const avgCommandsPrevious = activeUsersPrevious > 0 ? messagesPrevious / activeUsersPrevious : 0;

        const kpis = {
            totalUsers: {
                value: totalUsers,
                change: calculateChange(newUsersCurrent, newUsersPrevious)
            },
            activeUsers: {
                value: activeUsersCurrent,
                change: calculateChange(activeUsersCurrent, activeUsersPrevious)
            },
            messageVolume: {
                value: messagesCurrent,
                change: calculateChange(messagesCurrent, messagesPrevious)
            },
            avgCommandsPerUser: {
                value: avgCommandsCurrent,
                change: calculateChange(avgCommandsCurrent, avgCommandsPrevious)
            }
        };

        res.json({
            kpis,
            userGrowth,
            topCommands
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;


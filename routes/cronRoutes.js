const express = require('express');
const router = express.Router();
const CronJob = require('../DB/CronJob');
const { scheduleJob, cancelJob } = require('../utilities/cronManager');

// Get all cron jobs
router.get('/', async (req, res) => {
    try {
        const jobs = await CronJob.find().sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching cron jobs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get a single cron job by ID
router.get('/:id', async (req, res) => {
    try {
        const job = await CronJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    } catch (error) {
        console.error('Error fetching cron job:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create a new cron job
router.post('/', async (req, res) => {
    try {
        const { name, schedule, type, action, broadcast } = req.body;
        
        // Basic validation
        if (!name || !schedule || !type || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newJob = new CronJob({ name, schedule, type, action, broadcast });
        await newJob.save();

        if (newJob.enabled) {
            scheduleJob(newJob, req.app.locals.bot);
        }

        res.status(201).json(newJob);
    } catch (error) {
        console.error('Error creating cron job:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update a cron job
router.put('/:id', async (req, res) => {
    try {
        const { name, schedule, type, action, broadcast, enabled } = req.body;
        const job = await CronJob.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If only toggling 'enabled' status
        if (typeof enabled === 'boolean' && Object.keys(req.body).length === 1) {
             job.enabled = enabled;
        } else {
            // Full update
            job.name = name;
            job.schedule = schedule;
            job.type = type;
            job.action = action;
            job.broadcast = broadcast;
        }

        await job.save();
        
        // Reschedule or cancel the job based on its new state
        cancelJob(job.id); // Always cancel the old job first
        if (job.enabled) {
            scheduleJob(job, req.app.locals.bot);
        }

        res.json(job);
    } catch (error) {
        console.error('Error updating cron job:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete a cron job
router.delete('/:id', async (req, res) => {
    try {
        const job = await CronJob.findByIdAndDelete(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        cancelJob(job.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting cron job:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

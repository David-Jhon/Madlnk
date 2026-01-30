const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const { VM } = require('vm2');
const User = require('../DB/User');
const CommandLog = require('../DB/CommandLog');
const CronJob = require('../DB/CronJob');
const { exec } = require('child_process');

const scheduledTasks = new Map();

async function executeScript(job, bot) {
    console.log(`Executing 'script' job: ${job.name}`);
    const { code } = job.action;
    if (!code) {
        throw new Error('Script code not provided in action');
    }

    const sandbox = {
        bot,
        axios,
        cheerio,
        User,
        CommandLog,
        console,
        process: {
            env: {
                OWNER_ID: process.env.OWNER_ID,
                GC_ID: process.env.GC_ID,
                STORAGE_GROUP_ID: process.env.STORAGE_GROUP_ID,
                POST_FILE_GC_ID: process.env.POST_FILE_GC_ID
            }
        },
        setTimeout,
    };

    const vm = new VM({
        timeout: 10000, // 10 seconds
        sandbox,
        eval: false,
        wasm: false,
    });

    // Wrap the user's code in an async function to allow top-level await
    const asyncCode = `(async () => {
        ${code}
    })();`;

    return await vm.run(asyncCode);
}


async function executeCommand(job, bot) {
    console.log(`Executing 'command' job: ${job.name}`);
    const command = job.action.command;
    if (!command) {
        throw new Error('Command not provided in action');
    }

    console.log(`Attempting to execute command: ${command}`);
    const message = {
        text: command,
        chat: { id: process.env.OWNER_ID || 'default-chat-id' },
        from: { id: process.env.OWNER_ID || 'default-user-id' }
    };

    const commandName = command.split(' ')[0].substring(1);
    const commandHandler = bot.commands.get(commandName);
    if (commandHandler && commandHandler.onStart) {
        const args = command.split(' ').slice(1);
        await commandHandler.onStart({ bot, msg: message, args });
    } else {
        console.log(`Command ${commandName} not found or does not have an onStart handler.`)
    }
}

const jobExecutors = {
    command: executeCommand,
    script: executeScript,
};

function scheduleJob(job, bot) {
    if (scheduledTasks.has(job.id)) {
        scheduledTasks.get(job.id).stop();
        scheduledTasks.delete(job.id);
    }

    if (!cron.validate(job.schedule)) {
        console.error(`Invalid cron schedule for job ${job.name}: ${job.schedule}`);
        return;
    }

    const task = cron.schedule(job.schedule, async () => {
        try {
            await CronJob.findByIdAndUpdate(job.id, { $set: { status: 'running', lastRun: new Date() } });

            const executor = jobExecutors[job.type];
            let result = null;
            if (executor) {
                result = await executor(job, bot);
                await CronJob.findByIdAndUpdate(job.id, { $set: { status: 'success' } });
            } else {
                throw new Error(`No executor for job type: ${job.type}`);
            }

            // Handle broadcasting
            if (job.broadcast?.enabled && result) {
                console.log(`Broadcasting result for job: ${job.name}`);
                const message = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

                if (job.broadcast.target === 'owner') {
                    await bot.sendMessage(process.env.OWNER_ID, message, { parse_mode: 'HTML' });
                } else if (job.broadcast.target === 'all') {
                    // Broadcasting to all users
                    const users = await User.find({ isBot: false });
                    for (const user of users) {
                        try {
                            await bot.sendMessage(user.userId, message, { parse_mode: 'HTML' });
                        } catch (err) {
                            console.error(`Failed to broadcast message to ${user.userId}:`, err.message);
                        }
                    }

                } else if (job.broadcast.target === 'custom' && Array.isArray(job.broadcast.customIds)) {
                    // custom target
                    for (const id of job.broadcast.customIds) {
                        try {
                            await bot.sendMessage(id, message, { parse_mode: 'HTML' });
                        } catch (err) {
                            console.error(`Failed to broadcast message to custom target ${id}:`, err.message);
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`Error executing cron job ${job.name}:`, error);
            await CronJob.findByIdAndUpdate(job.id, { $set: { status: 'error' } });
        }
    });

    scheduledTasks.set(job.id, task);
    console.log(`Scheduled job: ${job.name}`);
}

function cancelJob(jobId) {
    if (scheduledTasks.has(jobId)) {
        scheduledTasks.get(jobId).stop();
        scheduledTasks.delete(jobId);
        console.log(`Canceled job: ${jobId}`);
    }
}

async function initialize(bot) {
    // Clear any existing tasks to prevent duplicates on restart
    for (const [id, task] of scheduledTasks.entries()) {
        task.stop();
        scheduledTasks.delete(id);
    }
    console.log('Cleared all scheduled tasks on initialization.');

    const jobs = await CronJob.find({ enabled: true });
    console.log(`Found ${jobs.length} enabled jobs to schedule.`);
    for (const job of jobs) {
        scheduleJob(job, bot);
    }
}

module.exports = {
    initialize,
    scheduleJob,
    cancelJob,
};

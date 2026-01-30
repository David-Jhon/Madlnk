const express = require('express');
const router = express.Router();
const userModel = require('../DB/User.js');

router.post('/', async (req, res) => {
    const { message, file_id, media_type, buttons, media_url } = req.body;
    const bot = req.app.locals.bot;

    if (!message && !file_id && !media_url) {
        return res.status(400).json({ error: 'Message content or media is required.' });
    }

    res.json({ message: 'Broadcast started. Messages are being sent in the background.' });

    sendBroadcastInBackground(bot, message, file_id || media_url, media_type, buttons);
});

async function sendSingleMessage(bot, chatId, message, fileIdOrUrl, media_type, buttons) {
    const sanitizedMessage = message ? message.replace(/<p><br><\/p>/g, '').replace(/<p>/g, '\n').replace(/<\/p>/g, '') : '';

    const baseOptions = {
        parse_mode: 'HTML'
    };

    if (buttons && buttons.length > 0) {
        baseOptions.reply_markup = {
            inline_keyboard: buttons
        };
    }

    if (fileIdOrUrl && media_type) {
        const mediaOptions = { ...baseOptions, caption: sanitizedMessage };
        let mediaToSend = fileIdOrUrl;

        switch (media_type) {
            case 'photo':
                await bot.sendPhoto(chatId, mediaToSend, mediaOptions);
                break;
            case 'video':
                await bot.sendVideo(chatId, mediaToSend, mediaOptions);
                break;
            case 'animation':
                await bot.sendAnimation(chatId, mediaToSend, mediaOptions);
                break;
            case 'document':
                await bot.sendDocument(chatId, mediaToSend, mediaOptions);
                break;
            case 'auto':
                try {
                    await bot.sendPhoto(chatId, mediaToSend, mediaOptions);
                } catch (e) {
                    console.error(`Auto-sending photo failed for ${chatId}, trying as document.`, e.message);
                    await bot.sendDocument(chatId, mediaToSend, mediaOptions);
                }
                break;
            default:
                if (sanitizedMessage) {
                    await bot.sendMessage(chatId, sanitizedMessage, baseOptions);
                }
        }
    } else if (sanitizedMessage) {
        await bot.sendMessage(chatId, sanitizedMessage, baseOptions);
    }
}

async function sendBroadcastInBackground(bot, message, fileIdOrUrl, media_type, buttons) {
    let successCount = 0;
    let failureCount = 0;

    try {
        const users = await userModel.find({}).select('userId').lean();
        console.log(`Starting broadcast to ${users.length} users.`);

        for (const user of users) {
            try {
                await sendSingleMessage(bot, user.userId, message, fileIdOrUrl, media_type, buttons);
                successCount++;
            } catch (error) {
                failureCount++;
                console.error(`Failed to send message to ${user.userId}:`, error.response ? error.response.body : error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`Broadcast finished. Success: ${successCount}, Failures: ${failureCount}`);

        const ownerId = process.env.OWNER_ID;
        if (ownerId) {
            await bot.sendMessage(ownerId, `Broadcast complete.\n\nSent: ${successCount}\nFailed: ${failureCount}`);
        }

    } catch (error) {
        console.error('A critical error occurred during the broadcast:', error);
        const ownerId = process.env.OWNER_ID;
        if (ownerId) {
            await bot.sendMessage(ownerId, `A critical error occurred during the broadcast process. Please check the logs.`);
        }
    }
}

router.post('/test', async (req, res) => {
    const { message, file_id, media_type, buttons, recipients, media_url } = req.body;
    const bot = req.app.locals.bot;
    const ownerId = process.env.OWNER_ID;

    if (!ownerId) {
        return res.status(500).json({ error: 'OWNER_ID is not set in environment variables.' });
    }

    if (!message && !file_id && !media_url) {
        return res.status(400).json({ error: 'Message content or media is required for testing.' });
    }

    let targetRecipients = recipients && recipients.length > 0 ? recipients : [ownerId];

    let successCount = 0;
    let failureCount = 0;
    const failedRecipients = [];
    const fileIdOrUrl = file_id || media_url;

    for (const recipient of targetRecipients) {
        try {

            const cleanedRecipient = recipient.startsWith('@') ? recipient : recipient;
            await sendSingleMessage(bot, cleanedRecipient, message, fileIdOrUrl, media_type, buttons);
            successCount++;
        } catch (error) {
            failureCount++;
            failedRecipients.push(recipient);
            console.error(`Failed to send test message to ${recipient}:`, error.response ? error.response.body : error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
    }

    if (failureCount === 0) {
        res.json({ message: `Test message sent successfully to ${successCount} recipient(s).` });
    } else {
        res.status(200).json({
            message: `Test message sent to ${successCount} recipient(s), failed for ${failureCount} recipient(s).`,
            failed: failedRecipients
        });
    }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('media'), async (req, res) => {
    const bot = req.app.locals.bot;
    const file = req.file;

    const chatId = process.env.POST_FILE_GC_ID;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        let message;
        let mediaType;
        let fileId;
        const fileOptions = { caption: file.originalname };

        const mimeType = file.mimetype;

        if (mimeType.startsWith('image/gif')) {
            mediaType = 'animation';
            message = await bot.sendAnimation(chatId, file.buffer, fileOptions);
            fileId = message.animation.file_id;
        } else if (mimeType.startsWith('image/')) {
            mediaType = 'photo';
            message = await bot.sendPhoto(chatId, file.buffer, fileOptions);
            fileId = message.photo[message.photo.length - 1].file_id;
        } else if (mimeType.startsWith('video/')) {
            mediaType = 'video';
            message = await bot.sendVideo(chatId, file.buffer, fileOptions);
            fileId = message.video.file_id;
        } else if (['application/pdf', 'application/zip', 'application/x-rar-compressed', 'application/octet-stream'].includes(mimeType) || file.originalname.endsWith('.apk')) {
            mediaType = 'document';
            message = await bot.sendDocument(chatId, file.buffer, fileOptions);
            fileId = message.document.file_id;
        } else {
            mediaType = 'document';
            message = await bot.sendDocument(chatId, file.buffer, fileOptions);
            fileId = message.document.file_id;
        }


        res.json({
            file_id: fileId,
            media_type: mediaType,
            file_name: file.originalname,
        });
    } catch (error) {
        console.error('Error uploading file to Telegram:', error);
        res.status(500).json({ error: 'Failed to process file.' });
    }
});

module.exports = router;

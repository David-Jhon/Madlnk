const storageGroupId = process.env.STORAGE_GROUP_ID;

// State management for tracking user sessions
const userStates = new Map();

// Timeout duration in milliseconds
const TIMEOUT_DURATION = 60000; // 60 seconds

module.exports = {
    name: 'genlink',
    version: 1.0,
    longDescription: 'Generate shareable links for messages stored in the database. Supports both single message and batch message link generation.',
    shortDescription: 'Generate shareable links for stored messages',
    guide: '{pn}',
    category: ['Admin', 99],

    lang: {
        selectMode: '<blockquote>✦ ʟɪɴᴋ ɢᴇɴᴇʀᴀᴛᴏʀ</blockquote>\n\n<b>sᴇʟᴇᴄᴛ ᴛʜᴇ ᴛʏᴘᴇ ᴏꜰ ʟɪɴᴋ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ:</b>',
        promptSingle: '<blockquote>✦ sɪɴɢʟᴇ ʟɪɴᴋ ᴍᴏᴅᴇ</blockquote>\n\n<b>ꜰᴏʀᴡᴀʀᴅ ᴀ ᴍᴇssᴀɢᴇ ꜰʀᴏᴍ ᴛʜᴇ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ (ᴡɪᴛʜ ǫᴜᴏᴛᴇs) ᴏʀ sᴇɴᴅ ᴛʜᴇ ᴍᴇssᴀɢᴇ ʟɪɴᴋ</b>\n\n<blockquote>» ᴛɪᴍᴇᴏᴜᴛ: 60 sᴇᴄᴏɴᴅs</blockquote>',
        promptBatchFirst: '<blockquote>✦ ʙᴀᴛᴄʜ ʟɪɴᴋ ᴍᴏᴅᴇ</blockquote>\n\nꜰᴏʀᴡᴀʀᴅ ᴛʜᴇ <b>ꜰɪʀsᴛ</b> ᴍᴇssᴀɢᴇ ꜰʀᴏᴍ ᴛʜᴇ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ ᴏʀ sᴇɴᴅ ᴛʜᴇ ᴍᴇssᴀɢᴇ ʟɪɴᴋ\n\n<blockquote>» ᴛɪᴍᴇᴏᴜᴛ: 60 sᴇᴄᴏɴᴅs</blockquote>',
        promptBatchLast: '<blockquote>✦ ʙᴀᴛᴄʜ ʟɪɴᴋ ᴍᴏᴅᴇ</blockquote>\n\nꜰᴏʀᴡᴀʀᴅ ᴛʜᴇ <b>ʟᴀsᴛ</b> ᴍᴇssᴀɢᴇ ꜰʀᴏᴍ ᴛʜᴇ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ ᴏʀ sᴇɴᴅ ᴛʜᴇ ᴍᴇssᴀɢᴇ ʟɪɴᴋ\n\n<blockquote>» ᴛɪᴍᴇᴏᴜᴛ: 60 sᴇᴄᴏɴᴅs</blockquote>',
        invalidMessage: '<blockquote>✗ ɪɴᴠᴀʟɪᴅ</blockquote>\n\nᴛʜɪs ᴍᴇssᴀɢᴇ ɪs ɴᴏᴛ ꜰʀᴏᴍ ᴍʏ sᴛᴏʀᴀɢᴇ ɢʀᴏᴜᴘ ᴏʀ ᴛʜᴇ ʟɪɴᴋ ɪs ɴᴏᴛ ᴠᴀʟɪᴅ',
        timeout: '<blockquote>✗ ᴛɪᴍᴇᴏᴜᴛ</blockquote>\n\nᴛʜᴇ ᴏᴘᴇʀᴀᴛɪᴏɴ ᴛɪᴍᴇᴅ ᴏᴜᴛ. ᴘʟᴇᴀsᴇ sᴛᴀʀᴛ ᴀɢᴀɪɴ ᴜsɪɴɢ /genlink',
        linkGenerated: (link) => `<blockquote>✓ ʟɪɴᴋ ɢᴇɴᴇʀᴀᴛᴇᴅ</blockquote>\n\n<a href="${link}">⟡ ᴄʟɪᴄᴋ ʜᴇʀᴇ</a>`,
        error: '<blockquote>✗ ᴇʀʀᴏʀ</blockquote>\n\nsᴏᴍᴇᴛʜɪɴɢ ᴡᴇɴᴛ ᴡʀᴏɴɢ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.',
    },

    onStart: async ({ bot, msg, args }) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (userId.toString() !== process.env.OWNER_ID) {
            return;
        }

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📄 Single', callback_data: 'genlink:single' },
                    { text: '📦 Batch', callback_data: 'genlink:batch' }
                ]
            ]
        };

        await bot.sendMessage(chatId, module.exports.lang.selectMode, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    },

    onCallback: async ({ bot, callbackQuery, params }) => {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const messageId = callbackQuery.message.message_id;
        const action = params[0]; // 'single' or 'batch'

        // Check if user is admin
        if (userId.toString() !== process.env.OWNER_ID) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.adminOnly });
        }

        try {
            await bot.answerCallbackQuery(callbackQuery.id);

            if (action === 'single') {
                // Initialize state for single mode
                userStates.set(userId, {
                    mode: 'single',
                    step: 'waiting_message',
                    chatId: chatId,
                    timeout: setTimeout(() => handleTimeout(bot, userId), TIMEOUT_DURATION)
                });

                await bot.editMessageText(module.exports.lang.promptSingle, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML'
                });

            } else if (action === 'batch') {
                // Initialize state for batch mode
                userStates.set(userId, {
                    mode: 'batch',
                    step: 'waiting_first',
                    chatId: chatId,
                    timeout: setTimeout(() => handleTimeout(bot, userId), TIMEOUT_DURATION)
                });

                await bot.editMessageText(module.exports.lang.promptBatchFirst, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML'
                });
            }
        } catch (error) {
            console.error('Error in genlink callback:', error);
            await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: 'HTML' });
        }
    },

    onChat: async ({ bot, msg, args }) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;

        // Check if user has an active state
        const state = userStates.get(userId);
        if (!state) return;

        try {
            // Extract message ID from forwarded message or link
            const msgId = await getMessageId(msg);

            if (!msgId) {
                return bot.sendMessage(chatId, module.exports.lang.invalidMessage, { parse_mode: 'HTML' });
            }

            // Clear existing timeout
            clearTimeout(state.timeout);

            if (state.mode === 'single') {
                // Generate single link
                await generateSingleLink(bot, userId, chatId, msgId);
                userStates.delete(userId);

            } else if (state.mode === 'batch') {
                if (state.step === 'waiting_first') {
                    // Store first message ID and prompt for last message
                    state.firstMsgId = msgId;
                    state.step = 'waiting_last';
                    state.timeout = setTimeout(() => handleTimeout(bot, userId), TIMEOUT_DURATION);

                    await bot.sendMessage(chatId, module.exports.lang.promptBatchLast, { parse_mode: 'HTML' });

                } else if (state.step === 'waiting_last') {
                    // Generate batch link
                    await generateBatchLink(bot, userId, chatId, state.firstMsgId, msgId);
                    userStates.delete(userId);
                }
            }
        } catch (error) {
            console.error('Error in genlink onChat:', error);
            await bot.sendMessage(chatId, module.exports.lang.error, { parse_mode: 'HTML' });
            userStates.delete(userId);
        }
    }
};


async function getMessageId(msg) {
    if (msg.forward_from_chat && msg.forward_from_chat.id.toString() === storageGroupId) {
        return msg.forward_from_message_id;
    }

    if (msg.text) {
        const text = msg.text.trim();

        // Match private group link format: https://t.me/c/1234567890/123
        const privateLinkMatch = text.match(/t\.me\/c\/(\d+)\/(\d+)/);
        if (privateLinkMatch) {
            const groupId = `-100${privateLinkMatch[1]}`;
            const messageId = parseInt(privateLinkMatch[2]);

            if (groupId === storageGroupId) {
                return messageId;
            }
        }

        // Match public channel link format: https://t.me/channelname/123
        const publicLinkMatch = text.match(/t\.me\/([^\/]+)\/(\d+)/);
        if (publicLinkMatch) {
            return parseInt(publicLinkMatch[2]);
        }
    }

    return null;
}

async function generateSingleLink(bot, userId, chatId, msgId) {
    const encodedId = msgId * Math.abs(parseInt(storageGroupId));
    const payload = `get-${encodedId}`;

    // Encode to base64 (URL-safe)
    const base64Payload = Buffer.from(payload).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const botUsername = (await bot.getMe()).username;
    const link = `https://t.me/${botUsername}?start=${base64Payload}`;

    // Create share button
    const keyboard = {
        inline_keyboard: [
            [
                { text: '⟡ sʜᴀʀᴇ ᴜʀʟ', url: `https://telegram.me/share/url?url=${encodeURIComponent(link)}` }
            ]
        ]
    };

    await bot.sendMessage(chatId, module.exports.lang.linkGenerated(link), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

/**
 * Generate and send batch message link
 */
async function generateBatchLink(bot, userId, chatId, firstMsgId, lastMsgId) {
    const encodedFirst = firstMsgId * Math.abs(parseInt(storageGroupId));
    const encodedLast = lastMsgId * Math.abs(parseInt(storageGroupId));
    const payload = `get-${encodedFirst}-${encodedLast}`;

    // Encode to base64 (URL-safe)
    const base64Payload = Buffer.from(payload).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const botUsername = (await bot.getMe()).username;
    const link = `https://t.me/${botUsername}?start=${base64Payload}`;

    // Create share button
    const keyboard = {
        inline_keyboard: [
            [
                { text: '⟡ sʜᴀʀᴇ ᴜʀʟ', url: `https://telegram.me/share/url?url=${encodeURIComponent(link)}` }
            ]
        ]
    };

    await bot.sendMessage(chatId, module.exports.lang.linkGenerated(link), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}


function handleTimeout(bot, userId) {
    const state = userStates.get(userId);
    if (state) {
        bot.sendMessage(state.chatId, module.exports.lang.timeout, { parse_mode: 'HTML' });
        userStates.delete(userId);
    }
}

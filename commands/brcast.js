const fs = require('fs');
const path = require('path');
const User = require('../DB/User');
const { buildParseModeButtons } = require('../utilities/messageUtils');

const POSTS_FILE = path.join(__dirname, '../store/posts.json');

// ==================== HELPER FUNCTIONS ====================

function readPosts() {
    try {
        if (!fs.existsSync(POSTS_FILE)) return { count: 0, posts: {} };
        return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading posts file:', error);
        return { count: 0, posts: {} };
    }
}

function savePosts(data) {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
}

function getPostById(postId) {
    return readPosts().posts[postId] || null;
}

function resolveTarget(target) {
    target = target.trim();

    const privateLinkMatch = target.match(/t\.me\/c\/(\d+)\//);
    if (privateLinkMatch) {
        return `-100${privateLinkMatch[1]}`;
    }

    const publicLinkMatch = target.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (publicLinkMatch) {
        return `@${publicLinkMatch[1]}`;
    }

    if (target.startsWith('@')) {
        return target;
    }
    if (/^-?\d+$/.test(target)) {
        return target;
    }

    return null;
}

async function sendPost(bot, chatId, post, options = {}) {
    const opts = {
        parse_mode: post.parseMode !== undefined ? post.parseMode : 'Markdown',
        disable_web_page_preview: !post.webPreview,
        disable_notification: options.silent || false,
        reply_markup: {
            inline_keyboard: post.buttons.map(row =>
                row.map(btn => ({ text: btn.text, url: btn.url }))
            )
        }
    };

    const textToSend = (post.text || "").replace(/\\`/g, '`');

    let sentMsg;
    try {
        if (post.type === 'text') {
            sentMsg = await bot.sendMessage(chatId, textToSend, opts);
        } else if (post.type === 'photo') {
            sentMsg = await bot.sendPhoto(chatId, post.fileId, { caption: textToSend, ...opts });
        } else if (post.type === 'video') {
            sentMsg = await bot.sendVideo(chatId, post.fileId, { caption: textToSend, ...opts });
        } else if (post.type === 'document') {
            sentMsg = await bot.sendDocument(chatId, post.fileId, { caption: textToSend, ...opts });
        } else if (post.type === 'sticker') {
            sentMsg = await bot.sendSticker(chatId, post.fileId, { disable_notification: opts.disable_notification });
        } else if (post.type === 'animation') {
            sentMsg = await bot.sendAnimation(chatId, post.fileId, { caption: textToSend, ...opts });
        }

        if (sentMsg && options.pin) {
            try {
                await bot.pinChatMessage(chatId, sentMsg.message_id);
            } catch (pinError) {
                console.error(`Failed to pin message in ${chatId}:`, pinError.message);
            }
        }
        return true;
    } catch (error) {
        // console.error(`Failed to send post to ${chatId}:`, error.message);
        return false;
    }
}

function renumberPosts(deletedId) {
    const data = readPosts();
    const posts = Object.values(data.posts).sort((a, b) => a.id - b.id);

    const newPosts = {};
    let count = 0;

    posts.forEach(post => {
        if (post.id === deletedId) return;

        count++;
        post.id = count;
        newPosts[count] = post;
    });

    data.posts = newPosts;
    data.count = count;
    savePosts(data);
}

// ==================== MODULE EXPORTS ====================

module.exports = {
    name: "brcast",
    version: 1.0,
    longDescription: "Broadcast posts to users, channels, or groups.",
    shortDescription: "Broadcast post",
    guide: "{pn} {id} | --del | --all | --pin | --silent | targets...",
    category: ['Admin', 99],

    lang: {
        usage: `*Usage:\n*
\`/brcast {id}\` - Broadcast post to your current chat.
\`/brcast {id} --all\` - Broadcast post to all users.
\`/brcast {id} --pin\` - Broadcast and pin post to your current chat.
\`/brcast {id} --silent\` - Broadcast post silently to your current chat.
\`/brcast {id} --del\` - Delete post and renumber remaining posts.
\`/brcast {id} --all --pin --silent\` - Combine flags as needed.
\`/brcast {id} | @username -1001234567890 https://t.me/c/1234567890/123\` - Broadcast to specific targets (usernames, chat IDs, or links).`,
        invalidId: "Invalid Post ID.",
        notFound: "Post `{id}` not found.",
        processing: "⏳ Processing broadcast...",
        progress: "⏳ Broadcasting... {processed}/{total}\n✅ Success: {success}\n❌ Failed: {failed}\n⏭ Skipped: {skipped}",
        dbError: "Database error during broadcast.",
        report: "📢 *Broadcast Complete*\n\n👥 Total: `{total}`\n✅ Success: `{success}`\n❌ Failed: `{failed}`\n⏭ Skipped: `{skipped}`",
        deleted: "\n\n🗑 Post `{id}` deleted and remaining posts renumbered."
    },

    onStart: async ({ bot, msg, args }) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (userId.toString() !== process.env.OWNER_ID) {
            return;
        }

        if (args.length === 0) {
            return bot.sendMessage(chatId, module.exports.lang.usage, { parse_mode: 'Markdown' });
        }

        const postId = parseInt(args[0]);
        if (isNaN(postId)) {
            return bot.sendMessage(chatId, module.exports.lang.invalidId, { parse_mode: 'Markdown' });
        }

        const post = getPostById(postId);
        if (!post) {
            return bot.sendMessage(chatId, module.exports.lang.notFound.replace('{id}', postId), { parse_mode: 'Markdown' });
        }

        // Parse flags and targets
        const fullText = msg.text.substring(msg.text.indexOf(args[0]) + args[0].length).trim();
        const parts = fullText.split('|');
        const flagsStr = parts[0].trim();
        const targetsStr = parts[1] ? parts[1].trim() : "";

        const flags = {
            del: flagsStr.includes('--del'),
            all: flagsStr.includes('--all'),
            pin: flagsStr.includes('--pin'),
            silent: flagsStr.includes('--silent')
        };

        const options = {
            pin: flags.pin,
            silent: flags.silent
        };

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;
        let totalCount = 0;
        const statusMsg = await bot.sendMessage(chatId, module.exports.lang.processing, { parse_mode: 'Markdown' });

        // ============ BROADCAST ALL ============
        if (flags.all) {
            try {
                const allUsers = await User.find({}).select('userId isBot');
                totalCount = allUsers.length;
                const users = allUsers.filter(u => !u.isBot);
                const totalUsers = totalCount;
                const botCount = totalUsers - users.length;
                let processed = 0;

                for (const user of users) {
                    const success = await sendPost(bot, user.userId, post, options);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                    }

                    processed++;
                    if (processed % 20 === 0) {
                        skippedCount = botCount + failCount;
                        await bot.editMessageText(module.exports.lang.progress
                            .replace('{processed}', processed)
                            .replace('{total}', users.length)
                            .replace('{success}', successCount)
                            .replace('{failed}', failCount)
                            .replace('{skipped}', skippedCount), {
                            chat_id: chatId,
                            message_id: statusMsg.message_id
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                skippedCount = botCount + failCount;
            } catch (dbError) {
                console.error("Database error:", dbError);
                return bot.sendMessage(chatId, module.exports.lang.dbError);
            }
        }
        // ============ TARGETS ============
        else if (targetsStr) {
            const targets = targetsStr.split(/[\s,]+/).filter(t => t);
            for (const target of targets) {
                const resolvedId = resolveTarget(target);
                if (resolvedId) {
                    const success = await sendPost(bot, resolvedId, post, options);
                    if (success) successCount++;
                    else failCount++;
                } else {
                    failCount++;
                }
            }
        }

        // ============ SELF TEST ============
        else {
            const success = await sendPost(bot, chatId, post, options);
            if (success) successCount++;
            else failCount++;
        }

        // ============ FINAL REPORT ============
        let report = module.exports.lang.report
            .replace('{total}', totalCount || (successCount + failCount))
            .replace('{success}', successCount)
            .replace('{failed}', failCount)
            .replace('{skipped}', skippedCount);

        if (flags.del) {
            renumberPosts(postId);
            report += module.exports.lang.deleted.replace('{id}', postId);
        }

        await bot.editMessageText(report, {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
        });
    },

    onInlineQuery: async ({ bot, inlineQuery }) => {
        const query = inlineQuery.query.trim().toLowerCase();
        const userId = inlineQuery.from.id;

        if (userId.toString() !== process.env.OWNER_ID) {
            return bot.answerInlineQuery(inlineQuery.id, [], {
                switch_pm_parameter: 'start',
                cache_time: 300
            });
        }

        if (!query.startsWith('post:')) return;

        const searchTerm = query.replace('post:', '').trim();
        const data = readPosts();
        let postsToShow = [];

        try {
            if (searchTerm === '') {

                postsToShow = Object.values(data.posts).sort((a, b) => a.id - b.id);
            } else if (/^\d+$/.test(searchTerm)) {

                const postId = parseInt(searchTerm);
                const post = data.posts[postId];
                if (post) postsToShow = [post];
            }

            if (postsToShow.length === 0) {
                return bot.answerInlineQuery(inlineQuery.id, [], {
                    switch_pm_text: 'No posts found',
                    switch_pm_parameter: 'createpost',
                    cache_time: 10
                });
            }

            postsToShow = postsToShow.slice(0, 50);

            const results = postsToShow.map(post => {
                const textToSend = (post.text || "").replace(/\\`/g, '`');
                const replyMarkup = post.buttons?.length > 0 ? {
                    inline_keyboard: post.buttons.map(row => row.map(btn => ({ text: btn.text, url: btn.url })))
                } : undefined;

                const baseResult = {
                    id: `post_${post.id}`,
                    title: `Post #${post.id}`,
                    parse_mode: post.parseMode ?? 'Markdown',
                    reply_markup: replyMarkup
                };

                const mediaTypes = {
                    photo: { type: 'photo', file_key: 'photo_file_id' },
                    video: { type: 'video', file_key: 'video_file_id' },
                    document: { type: 'document', file_key: 'document_file_id' },
                    animation: { type: 'gif', file_key: 'gif_file_id' }
                };

                if (mediaTypes[post.type]) {
                    const { type, file_key } = mediaTypes[post.type];
                    return { ...baseResult, type, [file_key]: post.fileId, caption: textToSend };
                }

                // Text/Article post
                return {
                    ...baseResult,
                    type: 'article',
                    description: textToSend.substring(0, 100).replace(/\n/g, ' ') || 'No caption',
                    input_message_content: {
                        message_text: textToSend,
                        parse_mode: baseResult.parse_mode
                    }
                };
            });

            await bot.answerInlineQuery(inlineQuery.id, results, {
                cache_time: 300
            });
        } catch (error) {
            console.error('Inline query error:', error);
            await bot.answerInlineQuery(inlineQuery.id, [], {
                switch_pm_text: 'Error loading posts',
                switch_pm_parameter: 'start',
                cache_time: 10
            });
        }
    }
};

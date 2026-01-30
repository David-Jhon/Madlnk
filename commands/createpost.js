const fs = require('fs');
const path = require('path');
const { buildParseModeButtons } = require('../utilities/messageUtils');

const POSTS_FILE = path.join(__dirname, '../store/posts.json');
const userStates = new Map();

// ==================== DATABASE FUNCTIONS ====================

function ensurePostsFile() {
    const dir = path.dirname(POSTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, JSON.stringify({ count: 0, posts: {} }));
}

function readPosts() {
    try {
        ensurePostsFile();
        return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading posts file:', error);
        return { count: 0, posts: {} };
    }
}

function getPostById(postId) {
    return readPosts().posts[postId] || null;
}

function getContentType(content) {
    if (content.text) return 'text';
    if (content.photo) return 'photo';
    if (content.video) return 'video';
    if (content.document) return 'document';
    if (content.sticker) return 'sticker';
    if (content.animation) return 'animation';
    return 'unknown';
}

function getFileId(content) {
    if (content.photo) return content.photo[content.photo.length - 1].file_id;
    if (content.video) return content.video.file_id;
    if (content.document) return content.document.file_id;
    if (content.sticker) return content.sticker.file_id;
    if (content.animation) return content.animation.file_id;
    return null;
}

function savePost(postId, content, buttons) {
    const data = readPosts();

    if (!postId) {
        data.count += 1;
        postId = data.count;
    }

    data.posts[postId] = {
        id: postId,
        type: getContentType(content),
        text: content.text || content.caption,
        fileId: getFileId(content),
        buttons: buttons,
        parseMode: content.parseMode,
        webPreview: content.webPreview,
        updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
    return postId;
}

// ==================== KEYBOARD BUILDERS ====================

function buildOptionsKeyboard(parseMode = 'Markdown', webPreview = false) {
    const parseModeButtons = [
        {
            text: parseMode === null ? "Normal ✅" : "Normal",
            callback_data: "createpost:mode:plain"
        },
        {
            text: parseMode === 'Markdown' ? "Markdown ✅" : "Markdown",
            callback_data: "createpost:mode:markdown"
        },
        {
            text: parseMode === 'HTML' ? "HTML ✅" : "HTML",
            callback_data: "createpost:mode:html"
        }
    ];

    const webPreviewButtons = [
        {
            text: webPreview ? "Yes ✅" : "Yes",
            callback_data: "createpost:webpreview:yes"
        },
        {
            text: !webPreview ? "No ✅" : "No",
            callback_data: "createpost:webpreview:no"
        }
    ];

    return {
        inline_keyboard: [
            [{ text: "Parse Mode", callback_data: "createpost:noaction" }],
            parseModeButtons,
            [{ text: "Web page preview", callback_data: "createpost:noaction" }],
            webPreviewButtons,
            [{ text: "❌ Close", callback_data: "createpost:closeoptions" }]
        ]
    };
}

function buildEditorKeyboard(buttons, parseMode = 'Markdown') {
    const keyboard = buttons.map((row, rowIndex) => [
        ...row.map((btn, btnIndex) => ({
            text: btn.text,
            callback_data: `createpost:del:${rowIndex}:${btnIndex}`
        })),
        { text: "➕", callback_data: `createpost:add:${rowIndex}` }
    ]);

    keyboard.push(
        [{ text: "➕ New Row", callback_data: "createpost:new_row" }],
        [
            { text: "Edit", callback_data: "createpost:editcontent" },
            { text: "Preview", callback_data: "createpost:preview" },
            { text: "⚙ Options", callback_data: "createpost:options" }
        ],
        [
            { text: "Done", callback_data: "createpost:done" },
            { text: "Cancel", callback_data: "createpost:cancel" }
        ]
    );

    return { inline_keyboard: keyboard };
}

function buildPreviewKeyboard(buttons) {
    return {
        inline_keyboard: buttons.map(row =>
            row.map(btn => ({ text: btn.text, url: btn.url }))
        )
    };
}

// ==================== HELPER FUNCTIONS ====================

async function updateEditor(bot, chatId, state) {
    try {
        await bot.editMessageReplyMarkup(buildEditorKeyboard(state.buttons, state.parseMode), {
            chat_id: chatId,
            message_id: state.editorMessageId
        });
    } catch (error) {
        console.error("Error updating editor:", error.message);
    }
}

function parseButtonString(text) {
    return text.split('\n')
        .filter(line => line.trim())
        .map(line => {
            return line.split('+')
                .map(part => {
                    const btnParts = part.includes('=') ? part.split('=') : part.split('-');
                    if (btnParts.length < 2) return null;

                    const btnText = btnParts[0].trim();
                    const btnUrl = btnParts.slice(1).join('=').trim();

                    if (!btnText || !btnUrl) return null;

                    return {
                        text: btnText,
                        url: btnUrl.startsWith('http') ? btnUrl : 'https://' + btnUrl
                    };
                })
                .filter(btn => btn !== null);
        })
        .filter(row => row.length > 0);
}

async function sendByType(bot, chatId, content, caption, opts) {
    const methods = {
        text: () => bot.sendMessage(chatId, caption, opts),
        photo: () => bot.sendPhoto(chatId, content.photo[content.photo.length - 1].file_id, { caption, ...opts }),
        video: () => bot.sendVideo(chatId, content.video.file_id, { caption, ...opts }),
        document: () => bot.sendDocument(chatId, content.document.file_id, { caption, ...opts }),
        sticker: () => bot.sendSticker(chatId, content.sticker.file_id, opts),
        animation: () => bot.sendAnimation(chatId, content.animation.file_id, { caption, ...opts })
    };

    const type = getContentType(content);
    return methods[type] ? await methods[type]() : null;
}

async function sendContentMessage(bot, chatId, content, caption, keyboard, parseMode = 'Markdown', webPreview = false) {
    try {
        return await sendByType(bot, chatId, content, caption, {
            reply_markup: keyboard,
            parse_mode: parseMode,
            disable_web_page_preview: !webPreview
        });
    } catch (error) {
        return await sendByType(bot, chatId, content, caption, { reply_markup: keyboard });
    }
}

async function loadPostIntoEditor(bot, chatId, userId, post) {
    const content = {};
    if (post.type === 'text') {
        content.text = post.text;
    } else if (post.type === 'photo') {
        content.photo = [{ file_id: post.fileId }];
        content.caption = post.text;
    } else if (post.type === 'video') {
        content.video = { file_id: post.fileId };
        content.caption = post.text;
    } else if (post.type === 'document') {
        content.document = { file_id: post.fileId };
        content.caption = post.text;
    } else if (post.type === 'sticker') {
        content.sticker = { file_id: post.fileId };
    } else if (post.type === 'animation') {
        content.animation = { file_id: post.fileId };
        content.caption = post.text;
    }

    const state = {
        step: 'EDITING',
        content: content,
        buttons: post.buttons || [[]],
        editorMessageId: null,
        editingRow: null,
        promptMessageId: null,
        instructionMessageId: null,
        postId: post.id,
        isEditing: true,
        parseMode: post.parseMode !== undefined ? post.parseMode : 'Markdown',
        optionsMessageId: null,
        webPreview: post.webPreview !== undefined ? post.webPreview : false
    };

    userStates.set(userId, state);

    const keyboard = buildEditorKeyboard(state.buttons);
    const sentMsg = await sendByType(bot, chatId, content, post.text || "", {
        reply_markup: keyboard,
        parse_mode: state.parseMode,
        disable_web_page_preview: !state.webPreview
    });

    if (sentMsg) state.editorMessageId = sentMsg.message_id;

    const instrMsg = await bot.sendMessage(chatId, module.exports.lang.editorIntro, { parse_mode: 'Markdown' });
    state.instructionMessageId = instrMsg.message_id;
}

// ==================== MODULE EXPORTS ====================

module.exports = {
    name: "createpost",
    version: 3.4,
    longDescription: "Create and save rich posts with an interactive button editor.",
    shortDescription: "Create a new post",
    guide: "{pn} [post_id]",
    category: ['Admin', 99],
    lang: {
        start: "Please send the content for your post (Text, Photo, Video, Sticker, Animation)",
        editorIntro: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀ ⠀⚡ 𝗘𝗗𝗜𝗧𝗢𝗥 𝗠𝗢𝗗𝗘 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\n" +
            "▹ Click *[+]* to add button\n" +
            "▹ Click *Button* to delete it\n" +
            "▹ Click *New Row* for new line\n" +
            "▹ Click *Edit* to change content\n" +
            "▹ Click *Preview* to view final\n" +
            "▹ Click *Done* to save",
        sendBtnData: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  ⚙ 𝗕𝗨𝗧𝗧𝗢𝗡 𝗙𝗢𝗥𝗠𝗔𝗧 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\n" +
            "*Single:*\n`Text = link.com`\n\n" +
            "*Same Row:*\n`Text1 = link1 + Text2 = link2`\n\n" +
            "*Multiple Rows:*\n`Text1 = link1`\n`Text2 = link2`",
        saved: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  ✓ 𝗣𝗢𝗦𝗧 𝗦𝗔𝗩𝗘𝗗 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\n*Post ID:* `{id}`\n\n*Edit:* `/createpost {id}`",
        updated: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  ✓ 𝗣𝗢𝗦𝗧 𝗨𝗣𝗗𝗔𝗧𝗘𝗗 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\n*Post ID:* `{id}`",
        cancelled: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  ✕ 𝗖𝗔𝗡𝗖𝗘𝗟𝗟𝗘𝗗 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\nPost creation cancelled.",
        notFound: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  ✕ 𝗡𝗢𝗧 𝗙𝗢𝗨𝗡𝗗 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\nPost `{id}` does not exist.",
        invalidFormat: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  ✕ 𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗙𝗢𝗥𝗠𝗔𝗧 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\nUse: `Text = URL`",
        editContent: "┏━━━━━━━━━━━━━━━━━━━━━┓\n⠀ ⠀  𝗘𝗗𝗜𝗧 𝗖𝗢𝗡𝗧𝗘𝗡𝗧 \n┗━━━━━━━━━━━━━━━━━━━━━┛\n\nSend new content to replace current."
    },

    onStart: async ({ bot, msg, args }) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (userId.toString() !== process.env.OWNER_ID) {
            return;
        }

        const postId = args[0] ? parseInt(args[0]) : null;

        if (postId) {
            const post = getPostById(postId);
            if (!post) {
                return bot.sendMessage(chatId, module.exports.lang.notFound.replace('{id}', postId), { parse_mode: 'Markdown', disable_web_page_preview: true });
            }
            return loadPostIntoEditor(bot, chatId, userId, post);
        }

        userStates.set(userId, {
            step: 'WAITING_CONTENT',
            content: null,
            buttons: [[]],
            editorMessageId: null,
            editingRow: null,
            promptMessageId: null,
            instructionMessageId: null,
            postId: null,
            isEditing: false,
            parseMode: 'Markdown',
            optionsMessageId: null,
            webPreview: false
        });

        return bot.sendMessage(chatId, module.exports.lang.start, { parse_mode: 'Markdown', disable_web_page_preview: true });
    },

    onChat: async ({ bot, msg }) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const state = userStates.get(userId);

        if (!state) return;

        try {
            if (state.step === 'WAITING_CONTENT') {
                state.content = msg;
                state.step = 'EDITING';

                const caption = (msg.text || msg.caption || "").replace(/\\`/g, '`');
                const sentMsg = await sendContentMessage(bot, chatId, msg, caption, buildEditorKeyboard(state.buttons, state.parseMode), state.parseMode, state.webPreview);

                if (sentMsg) state.editorMessageId = sentMsg.message_id;

                const instrMsg = await bot.sendMessage(chatId, module.exports.lang.editorIntro, { parse_mode: 'Markdown', disable_web_page_preview: true });
                state.instructionMessageId = instrMsg.message_id;

            } else if (state.step === 'WAITING_BTN_DATA') {
                const parsedRows = parseButtonString(msg.text);

                if (state.promptMessageId) {
                    try { await bot.deleteMessage(chatId, state.promptMessageId); } catch (e) { }
                    state.promptMessageId = null;
                }

                if (parsedRows.length === 0) {
                    const errorMsg = await bot.sendMessage(chatId, module.exports.lang.invalidFormat, { parse_mode: 'Markdown', disable_web_page_preview: true });
                    setTimeout(() => {
                        try { bot.deleteMessage(chatId, errorMsg.message_id); } catch (e) { }
                    }, 3000);
                    return;
                }

                if (state.editingRow !== null && state.buttons[state.editingRow]) {
                    state.buttons[state.editingRow].push(...parsedRows[0]);
                    if (parsedRows.length > 1) {
                        state.buttons.splice(state.editingRow + 1, 0, ...parsedRows.slice(1));
                    }
                } else {
                    state.buttons.push(...parsedRows);
                }

                state.step = 'EDITING';
                state.editingRow = null;
                await updateEditor(bot, chatId, state);
            }
        } catch (error) {
            console.error("Error in createpost onChat:", error);
        }
    },

    onCallback: async ({ bot, callbackQuery }) => {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const data = callbackQuery.data;
        const state = userStates.get(userId);

        if (!state) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired." });
        }

        if (data === 'createpost:noaction') {
            return bot.answerCallbackQuery(callbackQuery.id);

            // Options menu callbacks
        } else if (data === 'createpost:options') {
            const keyboard = buildOptionsKeyboard(state.parseMode, state.webPreview);
            const optionsMsg = await bot.sendMessage(chatId, "Click on the desired option to select it.", {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            state.optionsMessageId = optionsMsg.message_id;
            return bot.answerCallbackQuery(callbackQuery.id);

        } else if (data === 'createpost:mode:markdown') {
            state.parseMode = 'Markdown';
            if (state.optionsMessageId) {
                try {
                    await bot.editMessageReplyMarkup(buildOptionsKeyboard(state.parseMode, state.webPreview), {
                        chat_id: chatId,
                        message_id: state.optionsMessageId
                    });
                } catch (e) { }
            }
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Mode: Markdown" });

        } else if (data === 'createpost:mode:html') {
            state.parseMode = 'HTML';
            if (state.optionsMessageId) {
                try {
                    await bot.editMessageReplyMarkup(buildOptionsKeyboard(state.parseMode, state.webPreview), {
                        chat_id: chatId,
                        message_id: state.optionsMessageId
                    });
                } catch (e) { }
            }
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Mode: HTML" });

        } else if (data === 'createpost:mode:plain') {
            state.parseMode = null;
            if (state.optionsMessageId) {
                try {
                    await bot.editMessageReplyMarkup(buildOptionsKeyboard(state.parseMode, state.webPreview), {
                        chat_id: chatId,
                        message_id: state.optionsMessageId
                    });
                } catch (e) { }
            }
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Mode: Plain Text" });

        } else if (data === 'createpost:webpreview:yes') {
            state.webPreview = true;
            if (state.optionsMessageId) {
                try {
                    await bot.editMessageReplyMarkup(buildOptionsKeyboard(state.parseMode, state.webPreview), {
                        chat_id: chatId,
                        message_id: state.optionsMessageId
                    });
                } catch (e) { }
            }
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Web preview: Enabled" });

        } else if (data === 'createpost:webpreview:no') {
            state.webPreview = false;
            if (state.optionsMessageId) {
                try {
                    await bot.editMessageReplyMarkup(buildOptionsKeyboard(state.parseMode, state.webPreview), {
                        chat_id: chatId,
                        message_id: state.optionsMessageId
                    });
                } catch (e) { }
            }
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Web preview: Disabled" });

        } else if (data === 'createpost:closeoptions') {
            if (state.optionsMessageId) {
                try { await bot.deleteMessage(chatId, state.optionsMessageId); } catch (e) { }
                state.optionsMessageId = null;
            }
            return bot.answerCallbackQuery(callbackQuery.id);

            // Existing callbacks
        } else if (data === 'createpost:editcontent') {
            state.step = 'WAITING_CONTENT';
            await bot.sendMessage(chatId, module.exports.lang.editContent, { parse_mode: 'Markdown', disable_web_page_preview: true });
            return bot.answerCallbackQuery(callbackQuery.id);

        } else if (data.startsWith('createpost:add:')) {
            state.editingRow = parseInt(data.split(':')[2]);
            state.step = 'WAITING_BTN_DATA';
            const promptMsg = await bot.sendMessage(chatId, module.exports.lang.sendBtnData, { parse_mode: 'Markdown', disable_web_page_preview: true });
            state.promptMessageId = promptMsg.message_id;
            return bot.answerCallbackQuery(callbackQuery.id);

        } else if (data.startsWith('createpost:del:')) {
            const [, , rowIndex, btnIndex] = data.split(':').map(Number);

            if (state.buttons[rowIndex]) {
                state.buttons[rowIndex].splice(btnIndex, 1);
                if (state.buttons[rowIndex].length === 0 && state.buttons.length > 1) {
                    state.buttons.splice(rowIndex, 1);
                }
            }
            await updateEditor(bot, chatId, state);
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Button deleted" });

        } else if (data === 'createpost:new_row') {
            state.buttons.push([]);
            await updateEditor(bot, chatId, state);
            return bot.answerCallbackQuery(callbackQuery.id);

        } else if (data === 'createpost:preview') {
            const caption = (state.content.text || state.content.caption || "").replace(/\\`/g, '`');

            try {
                await sendByType(bot, chatId, state.content, caption, {
                    reply_markup: buildPreviewKeyboard(state.buttons),
                    parse_mode: state.parseMode,
                    disable_web_page_preview: !state.webPreview
                });
            } catch (e) {
                console.error("Preview error:", e);
                await bot.sendMessage(chatId, "**✕ ERROR**\n\nCannot generate preview.\n\n" + e.message, { parse_mode: 'Markdown', disable_web_page_preview: true });
            }
            return bot.answerCallbackQuery(callbackQuery.id);

        } else if (data === 'createpost:done') {

            const contentToSave = { ...state.content, parseMode: state.parseMode, webPreview: state.webPreview };

            const postId = savePost(state.postId, contentToSave, state.buttons);
            const message = state.isEditing
                ? module.exports.lang.updated.replace('{id}', postId)
                : module.exports.lang.saved.replace('{id}', postId);

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });

            try {
                await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: state.editorMessageId });
            } catch (e) { }

            if (state.instructionMessageId) {
                try { await bot.deleteMessage(chatId, state.instructionMessageId); } catch (e) { }
            }

            userStates.delete(userId);
            return bot.answerCallbackQuery(callbackQuery.id);

        } else if (data === 'createpost:cancel') {
            userStates.delete(userId);
            try { await bot.deleteMessage(chatId, state.editorMessageId); } catch (e) { }
            if (state.instructionMessageId) {
                try { await bot.deleteMessage(chatId, state.instructionMessageId); } catch (e) { }
            }
            await bot.sendMessage(chatId, module.exports.lang.cancelled, { parse_mode: 'Markdown', disable_web_page_preview: true });
            return bot.answerCallbackQuery(callbackQuery.id);
        }
    }
};

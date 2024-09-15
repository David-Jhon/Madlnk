const axios = require("axios");
const cheerio = require("cheerio");
const Nhentai = require("../DB/nhentai");

async function createTelegraPage(title, authorName, content) {
    try {
        const response = await axios.post(`https://api.telegra.ph/createPage`, {
            access_token:process.env.TELEGRAPH_ACCESS_TOKEN,
            title: title,
            author_name: authorName,
            content: content,
            return_content: true,
        });
        return response.data.result.url;
    } catch (error) {
        console.error("Failed to create Telegra.ph page:", error.message);
        return null;
    }
}

// Process images for Telegra.ph
async function processImagesForTelegra(doujin) {
    const imageUrls = doujin.imageUrls;
    const pagesPerPart = 100; // Number of pages per Telegra.ph page
    const totalPages = doujin.pages;

    const telegraPageUrls = [];

    const hasMultipleParts = totalPages > pagesPerPart;

    for (let start = 0; start < totalPages; start += pagesPerPart) {
        const end = Math.min(start + pagesPerPart, totalPages);
        const partImageUrls = imageUrls.slice(start, end);
        const content = partImageUrls.map((url, index) => ({
            tag: "img",
            attrs: { src: url },
            children: [{ tag: "p", children: [`Page ${start + index + 1}`] }],
        }));

        const partNumber = hasMultipleParts ? `_Part-${Math.floor(start / pagesPerPart) + 1}` : '';
        const partTitle = `${doujin.id}-${doujin.title.english || doujin.title.pretty || doujin.title.japanese || "Unknown Title"}${partNumber}`;

        const telegraPageUrl = await createTelegraPage(partTitle, "Anonymous", content);

        if (telegraPageUrl) {
            telegraPageUrls.push(telegraPageUrl);
        } else {
            console.error(`Failed to create Telegra.ph page for part starting at page ${start + 1}`);
        }
    }

    return telegraPageUrls;
}



// Download doujin data
async function downloadDoujin(doujinId) {
    const url = `https://nhentai.net/api/gallery/${encodeURIComponent(doujinId)}`;
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                'Referer': 'https://nhentai.net/',
            },
        });
        const doujin = response.data;
        const media_id = doujin.media_id;

        const imageUrls = doujin.images.pages.map((page, index) => {
            let ext = page.t === "j" ? "jpg" : "png";
            return `https://i7.nhentai.net/galleries/${encodeURIComponent(media_id)}/${index + 1}.${ext}`;
        });

        const coverExt = doujin.images.cover.t === "j" ? "jpg" : "png";
        const coverUrl = `https://t3.nhentai.net/galleries/${encodeURIComponent(media_id)}/cover.${coverExt}`;

        const extractTags = (type) =>
            doujin.tags.filter((tag) => tag.type === type).map((tag) => tag.name).join(", ");

        return {
            title: doujin.title,
            id: doujin.id,
            media_id,
            pages: doujin.images.pages.length,
            language: doujin.tags.find((tag) => tag.type === "language")?.name || "Unknown",
            tags: doujin.tags.filter((tag) => tag.type === "tag").map((tag) => tag.name),
            cover: coverUrl,
            coverExt: doujin.images.cover.t === "j" ? "jpg" : "png",
            imageUrls,
            parodies: extractTags("parody"),
            characters: extractTags("character"),
            artists: extractTags("artist"),
            groups: extractTags("group"),
            languages: extractTags("language"),
            categories: extractTags("category"),
        };
    } catch (error) {
        console.error("Failed to fetch doujin info:", error.message);
        return null;
    }
}

// Delay function
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Handle nhentai command
module.exports = (bot) => {
    async function handleNhentaiCommand(chatId, doujinId) {
        const existingDoujin = await Nhentai.findOne({ doujinId });

        if (existingDoujin) {
            let readOnlineLinks = "";

            if (existingDoujin.previews.telegraph_urls && Array.isArray(existingDoujin.previews.telegraph_urls)) {
                if (existingDoujin.previews.telegraph_urls.length === 1) {
                    // Single link
                    readOnlineLinks = `[View on Telegraph](${existingDoujin.previews.telegraph_urls[0]})`;
                } else {
                    // Multiple links
                    readOnlineLinks = existingDoujin.previews.telegraph_urls
                        .map((url, index) => `[View Part ${index + 1} on Telegraph](${url})`)
                        .join("\n➤ ");
                }
            }

            // Send the doujin information
            bot.sendPhoto(chatId, existingDoujin.thumbnail, {
                caption:
                    `
*Doujin ID*: #\`${existingDoujin.doujinId}\`
*Media ID*: \`${existingDoujin.mediaId}\`
*Title (English)*: \`${existingDoujin.title.english || "N/A"}\`
*Title (Japanese)*: \`${existingDoujin.title.japanese || "N/A"}\`
*Title (Pretty)*: \`${existingDoujin.title.pretty || "N/A"}\`
*Parodies*: ${existingDoujin.parodies || "N/A"}
*Characters*: ${existingDoujin.characters || "N/A"}
*Tags*: ${existingDoujin.tags.join(", ")}
*Artists*: ${existingDoujin.artists || "N/A"}
*Groups*: ${existingDoujin.groups || "N/A"}
*Languages*: ${existingDoujin.languages || "N/A"}
*Categories*: ${existingDoujin.categories || "N/A"}
*Total Pages*: ${existingDoujin.pages}
*Read online*: ➤ ${readOnlineLinks}
`,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "📥 Download",
                                callback_data: `download_${existingDoujin.doujinId}`,
                            },
                        ],
                    ],
                },
            });
            return;
        }

        // If doujin not found in the database, fetch it
        const doujin = await downloadDoujin(doujinId);
        if (!doujin) {
            bot.sendMessage(
                chatId,
                `Failed to retrieve doujin information for ID: \`${doujinId}\`. Please check if the ID is correct.`,
            );
            return;
        }

        bot.sendChatAction(chatId, "upload_photo");

        // Create the Telegra.ph pages
        const telegraPageUrls = await processImagesForTelegra(doujin);

        if (telegraPageUrls.length > 0) {
            // Save doujin info in the database
            const newDoujin = new Nhentai({
                doujinId: doujin.id,
                mediaId: doujin.media_id,
                title: doujin.title,
                tags: doujin.tags,
                pages: doujin.pages,
                thumbnail: doujin.cover,
                previews: { telegraph_urls: telegraPageUrls },
                parodies: doujin.parodies,
                characters: doujin.characters,
                artists: doujin.artists,
                groups: doujin.groups,
                languages: doujin.languages,
                categories: doujin.categories,
            });

            await newDoujin.save();

            // Generate the "Read online" section for the new doujin
            const readOnlineLinks = telegraPageUrls.length === 1
                ? `[View on Telegraph](${telegraPageUrls[0]})`
                : telegraPageUrls
                    .map((url, index) => `[View Part ${index + 1} on Telegraph](${url})`)
                    .join("\n➤ ");

            // Send the doujin information and Telegra.ph links
            bot.sendPhoto(chatId, doujin.cover, {
                caption: `
*Doujin ID*: #\`${doujin.id}\`
*Media ID*: \`${doujin.media_id}\`
*Title (English)*: \`${doujin.title.english || "N/A"}\`
*Title (Japanese)*: \`${doujin.title.japanese || "N/A"}\`
*Title (Pretty)*: \`${doujin.title.pretty || "N/A"}\`
*Parodies*: ${doujin.parodies || "N/A"}
*Characters*: ${doujin.characters || "N/A"}
*Tags*: ${doujin.tags.join(", ")}
*Artists*: ${doujin.artists || "N/A"}
*Groups*: ${doujin.groups || "N/A"}
*Languages*: ${doujin.languages || "N/A"}
*Categories*: ${doujin.categories || "N/A"}
*Total Pages*: ${doujin.pages}
*Read online*: ➤ ${readOnlineLinks}
                `,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "📥 Download",
                                callback_data: `download_${doujin.id}`,
                            },
                        ],
                    ],
                },
            });
        } else {
            bot.sendMessage(chatId, `Failed to create Telegra.ph pages.`);
        }
    }





    bot.on("callback_query", async (query) => {
        const chatId = query.message.chat.id;
        const callbackData = query.data; //error need to fix this


        if (callbackData.startsWith("download_")) {
            const doujinId = callbackData.split("_")[1]; 

            const doujin = await downloadDoujin(doujinId);
            if (doujin) {
                const batchSize = 6;
                const totalPages = doujin.pages;

                for (let i = 0; i < doujin.imageUrls.length; i += batchSize) {
                    const imagesToSend = doujin.imageUrls.slice(
                        i,
                        i + batchSize,
                    );

                    const mediaGroup = imagesToSend.map((url, index) => ({
                        type: "photo",
                        media: url,
                        caption:
                            index === 0
                                ? `Pages ${i + 1}-${Math.min(i + batchSize, totalPages)}/${totalPages}`
                                : undefined,
                    }));

                    bot.sendChatAction(chatId, "upload_photo");

                    if (mediaGroup.length > 0) {
                        try {
                            await bot.sendMediaGroup(chatId, mediaGroup);
                        } catch (error) {
                            console.error(
                                `Failed to send media group. Error: ${error.message}`,
                            );
                            bot.sendMessage(
                                chatId,
                                `Failed to send images in batch.`,
                            );
                        }
                    }
                    await delay(10000);
                }
            } else {
                bot.sendMessage(chatId, "Failed to download doujin images.");
            }
        }
    });

    // Inline search query handler
    bot.on("inline_query", async (query) => {
        const { id, query: searchQuery } = query;

        const doujins = await searchDoujin(searchQuery);

        const results = doujins.map((doujin) => {
            let flag = "🇯🇵"; // Default flag is Japanese
            if (doujin.language.toLowerCase() === "english") flag = "🇺🇸";
            else if (doujin.language.toLowerCase() === "chinese") flag = "🇨🇳";

            return {
                type: "article",
                id: doujin.id.toString(),
                title: `${flag} ${doujin.title}`,
                input_message_content: {
                    message_text: `/nhentai ${doujin.id}`,
                },
                thumb_url: `https://t3.nhentai.net/galleries/${doujin.media_id}/thumb.jpg`,
                description: `ID: ${doujin.id} | Language: ${doujin.language}`,
            };
        });

        bot.answerInlineQuery(id, results);
    });

    bot.onText(/\/nhentai(\s*\d+)?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const doujinId = match[1] ? match[1].trim() : null;

        if (!doujinId) {
            bot.sendMessage(
                chatId,
                "Please provide the NUKE code! 👀 \n\nExample: `/nhentai 123456` or use the search button below.",
                {
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "🔍 Find Doujins",
                                    switch_inline_query_current_chat: "",
                                },
                            ],
                            [
                                {
                                    text: "⭐ Popular",
                                    switch_inline_query_current_chat: "⭐️",
                                },
                                {
                                    text: "🆕 Newest",
                                    switch_inline_query_current_chat: "🆕",
                                },
                            ],
                        ],
                    },
                },
            );
            return;
        }

        await handleNhentaiCommand(chatId, doujinId);
    });
};
// search doujinshi using inline query
async function searchDoujin(query) {
    const searchUrl = `https://nhentai.net/search/?q=${encodeURIComponent(query)}&sort=popular`;

    try {
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);
        const results = [];

        $(".gallery").each((index, element) => {
            if (index < 30) {
                // Limit to top 30
                const id = $(element).find("a").attr("href").split("/")[2];
                const title = $(element).find(".caption").text().trim();
                const media_id = $(element)
                    .find("a > img")
                    .attr("data-src")
                    .split("/")[4];
                const isEnglish = title.toLowerCase().includes("english");
                const isChinese = title.toLowerCase().includes("chinese");
                const language = isEnglish
                    ? "English"
                    : isChinese
                      ? "Chinese"
                      : "Japanese";

                results.push({
                    id,
                    title,
                    language,
                    media_id,
                });
            }
        });

        return results;
    } catch (error) {
        console.error("Failed to search doujinshi:", error.message);
        return [];
    }
}

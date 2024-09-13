const axios = require('axios');

// Function to download the doujin info and images with necessary headers
async function downloadDoujin(doujinId) {
    const url = `https://nhentai.net/api/gallery/${encodeURIComponent(doujinId)}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const doujin = response.data;
        const media_id = doujin.media_id;

        const imageUrls = doujin.images.pages.map((page, index) => {
            let ext = page.t === 'j' ? 'jpg' : 'png'; // Determine if it's jpg or png
            return `https://i7.nhentai.net/galleries/${encodeURIComponent(media_id)}/${index + 1}.${ext}`;
        });

        // Cover image URL determination
        const coverExt = doujin.images.cover.t === 'j' ? 'jpg' : 'png';
        const coverUrl = `https://t3.nhentai.net/galleries/${encodeURIComponent(media_id)}/cover.${coverExt}`;

        return {
            title: doujin.title,
            id: doujin.id,
            media_id: media_id,
            pages: doujin.images.pages.length,
            language: doujin.tags.find(tag => tag.type === 'language')?.name || 'Unknown',
            tags: doujin.tags.filter(tag => tag.type === 'tag').map(tag => tag.name),
            cover: coverUrl,
            coverExt,
            imageUrls,
            parodies: doujin.tags.filter(tag => tag.type === 'parody').map(tag => tag.name).join(', '),
            characters: doujin.tags.filter(tag => tag.type === 'character').map(tag => tag.name).join(', '),
            artists: doujin.tags.filter(tag => tag.type === 'artist').map(tag => tag.name).join(', '),
            groups: doujin.tags.filter(tag => tag.type === 'group').map(tag => tag.name).join(', '),
            languages: doujin.tags.filter(tag => tag.type === 'language').map(tag => tag.name).join(', '),
            categories: doujin.tags.filter(tag => tag.type === 'category').map(tag => tag.name).join(', ')
            //uploaded: doujin.upload_date
        };
    } catch (error) {
        console.error("Failed to fetch doujin info:", error.message);
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = (bot) => {
    async function handleNhentaiCommand(chatId, doujinId) {
        const doujin = await downloadDoujin(doujinId);
        if (!doujin) {
            bot.sendMessage(chatId, `Failed to retrieve doujin information for ID: \`${doujinId}\`. Please check if the ID is correct.`);
            return;
        }

        bot.sendChatAction(chatId, 'upload_photo');

        // Send doujin information with cover image URL
        try {
            await bot.sendPhoto(chatId, doujin.cover, {
                caption: `
*Doujin ID*: #\`${doujin.id}\`
*Media ID*: \`${doujin.media_id}\`
*Title (English)*: \`${doujin.title.english || 'N/A'}\`
*Title (Japanese)*: \`${doujin.title.japanese || 'N/A'}\`
*Title (Pretty)*: \`${doujin.title.pretty || 'N/A'}\`
*Parodies*: ${doujin.parodies || 'N/A'}
*Characters*: ${doujin.characters || 'N/A'}
*Tags*: ${doujin.tags.join(', ')}
*Artists*: ${doujin.artists || 'N/A'}
*Groups*: ${doujin.groups || 'N/A'}
*Languages*: ${doujin.languages || 'N/A'}
*Categories*: ${doujin.categories || 'N/A'}
*Total Pages*: ${doujin.pages}
                `,
                //*Uploaded*: ${doujin.uploaded || 'N/A'}
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error(`Failed to send cover image. Error: ${error.message}`);
            bot.sendMessage(chatId, `Failed to send the cover image.`);
        }

        // Send images in batches using sendMediaGroup with direct URLs
        const batchSize = 6;
        const totalPages = doujin.pages;

        for (let i = 0; i < doujin.imageUrls.length; i += batchSize) {
            const imagesToSend = doujin.imageUrls.slice(i, i + batchSize);

            // Prepare media group with URLs
            const mediaGroup = imagesToSend.map((url, index) => ({
                type: 'photo',
                media: url,
                caption: index === 0 ? `Pages ${i + 1}-${Math.min(i + batchSize, totalPages)}/${totalPages}` : undefined
            }));
            
            bot.sendChatAction(chatId, 'upload_photo');
            
            if (mediaGroup.length > 0) {
                try {
                    await bot.sendMediaGroup(chatId, mediaGroup);
                } catch (error) {
                    console.error(`Failed to send media group. Error: ${error.message}`);
                    bot.sendMessage(chatId, `Failed to send images in batch.`);
                }
            }

            // Wait for 10 seconds before sending the next batch, with additional delay for larger images
            const additionalWait = doujin.imageUrls.length > 20 ? 5000 : 0; // Add extra time if more than 20 pages
            await delay(10000 + additionalWait);
        }
    }

    bot.onText(/\/nhentai(\s*\d+)?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const doujinId = match[1] ? match[1].trim() : null;

        if (!doujinId) {
            bot.sendMessage(chatId, "Please provide the NUKE code! 👀 \n\nExample: `/nhentai 123456`", {
                parse_mode: 'Markdown'
            });
            return;
        }

        await handleNhentaiCommand(chatId, doujinId);
    });

};

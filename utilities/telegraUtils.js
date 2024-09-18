const axios = require('axios');
const FormData = require('form-data');
const cheerio = require("cheerio");

async function createTelegraPage(title, authorName, authorUrl, content) {
    try {
        const response = await axios.post('https://api.telegra.ph/createPage', {
            access_token: process.env.TELEGRAPH_ACCESS_TOKEN,
            title: title,
            author_name: authorName,
            author_url: authorUrl,
            content: content,
            return_content: true,
        });
        return response.data.result.url;
    } catch (error) {
        console.error('Failed to create Telegra.ph page:', error.message);
        return null;
    }
}

async function processImagesForTelegra(doujin) {
    const imageUrls = doujin.imageUrls;
    const pagesPerPart = 99;
    const totalPages = doujin.pages;

    const telegraPageUrls = [];
    const hasMultipleParts = totalPages > pagesPerPart;

    for (let start = 0; start < totalPages; start += pagesPerPart) {
        const end = Math.min(start + pagesPerPart, totalPages);
        const partImageUrls = imageUrls.slice(start, end);

        const imgurUrls = await Promise.all(partImageUrls.map(async (url, index) => {
            const ext = url.split('.').pop(); // Get image extension (e.g., jpg, png)

            // Attempt to fetch image buffer from original URL
            let imageBuffer = await fetchImageBuffer(url);
            let uploadedUrl = null;

            // Retry uploading to Imgur with multiple attempts
            for (let attempt = 0; attempt < 3; attempt++) {
                if (imageBuffer) {
                    uploadedUrl = await uploadToImgur(imageBuffer, `page_${index + 1}.${ext}`, `image/${ext}`);
                }

                if (uploadedUrl) break;

                // If Imgur upload fails or no buffer, fall back to Nhentai domain and retry
                if (!uploadedUrl) {
                    console.warn(`Imgur upload failed for original URL, attempting fallback for page ${index + 1}`);
                    const fallbackUrl = getFallbackImageUrl(doujin.media_id, index, ext);
                    imageBuffer = await fetchImageBuffer(fallbackUrl); // Fetch buffer from fallback URL

                    if (imageBuffer) {
                        uploadedUrl = await uploadToImgur(imageBuffer, `page_${index + 1}.${ext}`, `image/${ext}`);
                    }

                    if (uploadedUrl) break;

                    if (attempt === 2) {
                        console.error(`Failed to upload image from fallback URL for page ${index + 1} after multiple attempts`);
                    }
                }
            }

            return uploadedUrl;
        }));

        const validImgurUrls = imgurUrls.filter(url => url !== null);

        // Create Telegra.ph page content with uploaded URLs
        const content = validImgurUrls.map((url, index) => ({
            tag: 'img',
            attrs: { src: url },
            children: [{ tag: 'p', children: [`Page ${start + index + 1}`] }],
        }));

        const partNumber = hasMultipleParts ? `_Part-${Math.floor(start / pagesPerPart) + 1}` : '';
        const partTitle = `${doujin.id}-${doujin.title.english || doujin.title.pretty || doujin.title.japanese || 'Unknown Title'}${partNumber}`;

        const telegraPageUrl = await createTelegraPage(partTitle, '@animedrive_bot', 'https://t.me/animedrive_bot', content);

        if (telegraPageUrl) {
            telegraPageUrls.push(telegraPageUrl);
        } else {
            console.error(`Failed to create Telegra.ph page for part starting at page ${start + 1}`);
        }
    }

    return telegraPageUrls;
}

async function fetchImageBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary');
    } catch (error) {
        console.error(`Failed to fetch image from ${url}:`, error.message);
        return null;
    }
}

async function uploadToImgur(imageBuffer, fileName, contentType) {
    const clientIds = [
        process.env.IMGUR_CLIENT_ID_1,
        process.env.IMGUR_CLIENT_ID_2,
        process.env.IMGUR_CLIENT_ID_3,
        process.env.IMGUR_CLIENT_ID_4
    ];

    try {
        const form = new FormData();
        form.append('image', imageBuffer, { filename: fileName, contentType: contentType });

        const uploadPromises = clientIds.map(clientId => axios.post('https://api.imgur.com/3/image', form, {
            headers: {
                'Authorization': `Client-ID ${clientId}`,
                'Referer': 'https://imgur.com/',
                ...form.getHeaders(),
            },
        }).then(response => response.data));

        const response = await Promise.any(uploadPromises);

        if (response.success) {
            return response.data.link;
        } else {
            console.error('Imgur upload failed:', response);
            return null;
        }
    } catch (error) {
        console.error('Error uploading image to Imgur:', error.message);
        return null;
    }
}

function getFallbackImageUrl(media_id, index, ext) {
    const domains = ["i", "i2", "i3", "i5", "i7"];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `https://${domain}.nhentai.net/galleries/${encodeURIComponent(media_id)}/${index + 1}.${ext}`;
}

module.exports = {
    createTelegraPage,
    processImagesForTelegra,
};

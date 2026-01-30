const axios = require("axios");

const PAGE_DOMAINS = ["i", "i2", "i3", "i5", "i7"];

/**
 * Check if an image URL is accessible
 */
async function isImageAccessible(url) {
  try {
    const res = await axios.head(url, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Validate image URLs and switch domain if needed
 */
async function validateAndFixImageUrls(imageUrls) {
  if (!imageUrls?.length) return imageUrls;

  const firstUrl = imageUrls[0];
  if (await isImageAccessible(firstUrl)) return imageUrls;

  const match = firstUrl.match(
    /https:\/\/(\w+)\.nhentai\.net\/galleries\/(\d+)\/(.+)/
  );

  if (!match) return imageUrls;

  const [, currentDomain, galleryId, filename] = match;

  for (const domain of PAGE_DOMAINS) {
    if (domain === currentDomain) continue;

    const testUrl = `https://${domain}.nhentai.net/galleries/${galleryId}/${filename}`;
    if (await isImageAccessible(testUrl)) {
      return imageUrls.map(url =>
        url.replace(
          /https:\/\/\w+\.nhentai\.net/,
          `https://${domain}.nhentai.net`
        )
      );
    }
  }

  return imageUrls;
}

/**
 * Create a Telegraph page
 */
async function createTelegraPage(title, authorName, authorUrl, content) {
  const { data } = await axios.post(
    "https://api.telegra.ph/createPage",
    {
      access_token: process.env.TELEGRAPH_ACCESS_TOKEN,
      title,
      author_name: authorName,
      author_url: authorUrl,
      content
    }
  );

  if (!data.ok) {
    throw new Error(`Telegraph API error: ${data.error}`);
  }

  return data.result.url;
}

/**
 * Split images into Telegraph pages
 */
async function processImagesForTelegra(doujin) {
  const pagesPerPart = 100;
  const urls = [];

  const validatedUrls = await validateAndFixImageUrls(doujin.imageUrls);

  for (let i = 0; i < validatedUrls.length; i += pagesPerPart) {
    const part = i / pagesPerPart + 1;
    const slice = validatedUrls.slice(i, i + pagesPerPart);

    const content = slice.map(url => ({
      tag: "img",
      attrs: { src: url }
    }));

    const pageUrl = await createTelegraPage(
      `${doujin.title.pretty} (Part ${part})`,
      "@animedrive_bot",
      "https://t.me/animedrive_bot",
      content
    );

    urls.push(pageUrl);
  }

  return urls;
}

module.exports = {
  processImagesForTelegra,
  validateAndFixImageUrls
};

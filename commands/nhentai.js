const axios = require("axios");
const cheerio = require("cheerio");
const Nhentai = require("../DB/nhentai");
const {
  processImagesForTelegra,
  validateAndFixImageUrls
} = require("../utilities/telegraUtils");

/* ---------------- CONFIG ---------------- */

const PAGE_DOMAINS = ["i", "i2", "i3", "i5", "i7"];
const THUMB_DOMAINS = ["t", "t2", "t3"];
const FALLBACK_THUMBNAIL = "https://i.ibb.co.com/VYTcrFrt/download.jpg";

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const mapExt = t => {
  switch (t) {
    case "p": return "png";
    case "w": return "webp";
    case "g": return "gif";
    default: return "jpg";
  }
};

const delay = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- NHENTAI API ---------------- */

async function downloadDoujin(doujinId) {
  try {
    const { data } = await axios.get(
      `https://nhentai.net/api/gallery/${encodeURIComponent(doujinId)}`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    const media_id = data.media_id;
    const pageDomain = pick(PAGE_DOMAINS);
    const thumbDomain = pick(THUMB_DOMAINS);

    const imageUrls = data.images.pages.map((p, i) =>
      `https://${pageDomain}.nhentai.net/galleries/${media_id}/${i + 1}.${mapExt(p.t)}`
    );

    const cover =
      `https://${thumbDomain}.nhentai.net/galleries/${media_id}/cover.${mapExt(data.images.cover.t)}`;

    const thumbnail =
      `https://${thumbDomain}.nhentai.net/galleries/${media_id}/thumb.${mapExt(data.images.thumbnail.t)}`;

    const extract = type =>
      data.tags.filter(t => t.type === type).map(t => t.name).join(", ");

    return {
      id: data.id,
      media_id,
      title: data.title,
      pages: data.images.pages.length,
      imageUrls,
      cover,
      thumbnail,
      tags: data.tags.filter(t => t.type === "tag").map(t => t.name),
      parodies: extract("parody"),
      characters: extract("character"),
      artists: extract("artist"),
      groups: extract("group"),
      languages: extract("language"),
      categories: extract("category")
    };
  } catch {
    return null;
  }
}

/* ---------------- COMMAND HANDLER ---------------- */

async function handleNhentaiCommand(chatId, doujinId, bot) {
  const cached = await Nhentai.findOne({ doujinId });

  /* -------- CACHED -------- */
  if (cached) {
    const buttons = cached.previews.telegraph_urls.map((url, i) => [
      { text: `📖 Read Part ${i + 1}`, url }
    ]);

    buttons.push([
      { text: "📥 Download", callback_data: `nhentai:download:${cached.doujinId}` }
    ]);

    try {
      return await bot.sendPhoto(chatId, cached.thumbnail, {
        caption:
          `📕 *${cached.title.pretty}*\n\n🆔 ID: \`${cached.doujinId}\`\n📄 Pages: *${cached.pages}*`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons }
      });
    } catch {
      try {
        return await bot.sendPhoto(chatId, FALLBACK_THUMBNAIL, {
          caption:
            `📕 *${cached.title.pretty}*\n\n🆔 ID: \`${cached.doujinId}\`\n📄 Pages: *${cached.pages}*`,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: buttons }
        });
      } catch {
        return bot.sendMessage(
          chatId,
          `📕 *${cached.title.pretty}*\n\n🆔 ID: \`${cached.doujinId}\`\n📄 Pages: *${cached.pages}*`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
        );
      }
    }
  }

  /* -------- NEW FETCH -------- */
  const doujin = await downloadDoujin(doujinId);
  if (!doujin) {
    return bot.sendMessage(chatId, "❌ Failed to fetch doujin.");
  }

  await bot.sendChatAction(chatId, "upload_photo");

  const telegraph_urls = await processImagesForTelegra(doujin);

  await Nhentai.create({
    doujinId: doujin.id,
    mediaId: doujin.media_id,
    title: doujin.title,
    tags: doujin.tags,
    pages: doujin.pages,
    thumbnail: doujin.thumbnail,
    previews: { telegraph_urls },
    parodies: doujin.parodies,
    characters: doujin.characters,
    artists: doujin.artists,
    groups: doujin.groups,
    languages: doujin.languages,
    categories: doujin.categories
  });

  const buttons = telegraph_urls.map((url, i) => [
    { text: `📖 Read Part ${i + 1}`, url }
  ]);

  buttons.push([
    { text: "📥 Download", callback_data: `nhentai:download:${doujin.id}` }
  ]);

  try {
    await bot.sendPhoto(chatId, doujin.cover, {
      caption:
        `📕 *${doujin.title.pretty}*\n\n🆔 ID: \`${doujin.id}\`\n📄 Pages: *${doujin.pages}*`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons }
    });
  } catch {
    try {
      await bot.sendPhoto(chatId, FALLBACK_THUMBNAIL, {
        caption:
          `📕 *${doujin.title.pretty}*\n\n🆔 ID: \`${doujin.id}\`\n📄 Pages: *${doujin.pages}*`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons }
      });
    } catch {
      await bot.sendMessage(
        chatId,
        `📕 *${doujin.title.pretty}*\n\n🆔 ID: \`${doujin.id}\`\n📄 Pages: *${doujin.pages}*`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
      );
    }
  }
}

/* ---------------- SEARCH ---------------- */

async function searchDoujin(query) {
  const url =
    query === "⭐️" || query === "🆕"
      ? "https://nhentai.net/"
      : `https://nhentai.net/search/?q=${encodeURIComponent(query)}`;

  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const $ = cheerio.load(data);
  const results = [];

  $(".gallery").slice(0, 40).each((_, el) => {
    const id = $(el).find("a").attr("href").split("/")[2];
    const title = $(el).find(".caption").text().trim();
    const src = $(el).find("img").attr("data-src") || "";
    const media_id = src.split("/")[4];
    results.push({ id, title, media_id });
  });

  return results;
}

/* ---------------- EXPORT ---------------- */

module.exports = {
  name: "nhentai",
  version: 2.0,
  longDescription: "Fetch and display doujinshi from nhentai.net, with options to view online and download images.",
  shortDescription: "Get detailed info and read doujinshi",
  guide: "{pn} <doujin id>",
  category: ['Download', 4],
  lang: {
    noId: "Please provide the NUKE code! 👀\n\nExample: `/nhentai 123456` or use the search button below.",
    fetchError: "Failed to retrieve doujin information. Please check if the ID is correct.",
    telegraphError: "Failed to create Telegra.ph pages.",
    downloadError: "Failed to download doujin images.",
  },

  onStart: async ({ bot, msg, args }) => {
    if (!args[0]) {
      return bot.sendMessage(
        msg.chat.id,
        "Usage: `/nhentai <id>`",
        { parse_mode: "Markdown" }
      );
    }
    await handleNhentaiCommand(msg.chat.id, args[0], bot);
  },

  onCallback: async ({ bot, callbackQuery, params }) => {
    if (params[0] !== "download") return bot.answerCallbackQuery(callbackQuery.id);

    const doujin = await downloadDoujin(params[1]);
    if (!doujin) return bot.answerCallbackQuery(callbackQuery.id);

    const urls = await validateAndFixImageUrls(doujin.imageUrls);
    const batchSize = 9;

    for (let i = 0; i < urls.length; i += batchSize) {
      const media = urls.slice(i, i + batchSize).map((url, idx) => ({
        type: "photo",
        media: url,
        caption: idx === 0
          ? `Pages ${i + 1}-${Math.min(i + batchSize, doujin.pages)} / ${doujin.pages}`
          : undefined
      }));

      await bot.sendMediaGroup(callbackQuery.message.chat.id, media);
      await delay(7000);
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  },

  onInline: async ({ bot, inlineQuery }) => {
    const results = await searchDoujin(inlineQuery.query);

    await bot.answerInlineQuery(
      inlineQuery.id,
      results.map(d => ({
        type: "article",
        id: d.id,
        title: d.title,
        input_message_content: { message_text: `/nhentai ${d.id}` },
        thumb_url: `https://${pick(THUMB_DOMAINS)}.nhentai.net/galleries/${d.media_id}/thumb.webp`
      }))
    );
  }
};

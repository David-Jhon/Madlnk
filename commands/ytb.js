const { spawn } = require("child_process");
const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

/* ================= CONFIGURATION ================= */

const CONFIG = {
  TMP_DIR: path.join(__dirname, "../downloads"),
  COOKIE_FILE: path.join(__dirname, "../yt.txt"),
  TG_LIMIT: 50 * 1024 * 1024, // 50MB
  URL_REGEX: /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w|-]{11})(?:\S+)?$/,
  YTDLP_BIN: "python3.12",
  YTDLP_PREFIX: ["-m", "yt_dlp"],
  CLEANUP_INTERVAL: 10 * 60 * 1000 // 10 minutes
};

/* ================= SERVICES ================= */

class YouTubeService {
  constructor() {
    fs.ensureDirSync(CONFIG.TMP_DIR);
  }

  run(cmd, args) {
    return new Promise((resolve, reject) => {
      const finalCmd = cmd === "yt-dlp" ? CONFIG.YTDLP_BIN : cmd;
      const finalArgs = cmd === "yt-dlp" ? [...CONFIG.YTDLP_PREFIX, ...args] : args;

      const p = spawn(finalCmd, finalArgs, { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";

      p.stdout.on("data", d => (out += d.toString()));
      p.stderr.on("data", d => (err += d.toString()));

      p.on("close", code => {
        if (code === 0) return resolve(out);
        console.error("FAILED:", finalCmd, finalArgs.join(" "));
        console.error(err || out);
        reject(new Error("Process failed"));
      });
    });
  }

  async search(query) {
    // Direct ID extraction (fast path)
    const match = query.match(CONFIG.URL_REGEX);
    if (match) {
      return this.handleDirectLink(match[1], query);
    }
    return this.handleSearch(query);
  }

  async handleDirectLink(videoId, originalQuery) {
    // 1. Scraping (Fast)
    try {
      const searchResults = await this.scrapeSearch(videoId);
      const exactMatch = searchResults.find(v => v.id === videoId);
      if (exactMatch) return { type: 'direct', data: exactMatch };
    } catch (e) {
      console.error("Fast search failed:", e.message);
    }

    // 2. yt-dlp (Fallback)
    const url = originalQuery.startsWith("http") ? originalQuery : `https://${originalQuery}`;
    const info = await this.getInfo(url, true);
    return info ? { type: 'direct', data: info } : null;
  }

  async handleSearch(query) {
    const results = await this.scrapeSearch(query);
    return results.length ? { type: 'search', data: results } : null;
  }

  async scrapeSearch(query) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);
    const jsonStr = data.split("ytInitialData = ")[1].split(";</script>")[0];
    const json = JSON.parse(jsonStr);

    const videos = json.contents.twoColumnSearchResultsRenderer.primaryContents
      .sectionListRenderer.contents[0]
      .itemSectionRenderer.contents;

    return videos
      .filter(v => v.videoRenderer)
      .map(v => {
        const r = v.videoRenderer;
        return {
          id: r.videoId,
          title: r.title.runs[0].text,
          duration: r.lengthText?.simpleText || "Live",
          channel: r.ownerText?.runs[0]?.text || "Unknown",
          url: `https://youtu.be/${r.videoId}`,
          thumbnail: r.thumbnail.thumbnails.pop().url
        };
      });
  }

  async getInfo(url, allowPlaylist = false) {
    const args = ["-J", "--cookies", CONFIG.COOKIE_FILE, "--remote-components", "ejs:github"];
    if (!allowPlaylist) args.push("--no-playlist");

    try {
      const raw = await this.run("yt-dlp", args.concat(url));
      const json = JSON.parse(raw);
      if (json.is_live) return null;

      return {
        id: json.id,
        title: json.title,
        duration: json.duration_string || "N/A",
        channel: json.uploader,
        url: json.webpage_url,
        thumbnail: json.thumbnail
      };
    } catch (e) {
      return null;
    }
  }

  async download(video, type, userId, messageId, bot, chatId) {
    const safeTitle = video.title.replace(/[^\w\d-_ ]/g, "");
    const base = `${userId}-${messageId}-${safeTitle}-${video.id}`;
    const out = path.join(CONFIG.TMP_DIR, `${base}.%(ext)s`);

    await bot.editMessageText("<blockquote>Preparing your media…</blockquote>",
      { chat_id: chatId, message_id: messageId, parse_mode: "HTML" });

    try {
      const args = [
        video.url,
        "--cookies", CONFIG.COOKIE_FILE,
        "--remote-components", "ejs:github",
        "--no-progress", "--quiet",
        "-o", out
      ];

      if (type === "video") {
        args.push(
          "-f", `bv*[ext=mp4][filesize_approx<${CONFIG.TG_LIMIT}]+ba/b[ext=mp4][filesize_approx<${CONFIG.TG_LIMIT}]/bv*+ba/b[filesize_approx<${CONFIG.TG_LIMIT}]/b`,
          "--merge-output-format", "mp4"
        );
      } else {
        args.push(
          "-f", `bestaudio[filesize_approx<${CONFIG.TG_LIMIT}]/bestaudio`,
          "-x", "--audio-format", "mp3",
          "--embed-thumbnail", "--add-metadata"
        );
      }

      await bot.editMessageText("<blockquote><b>Downloading… Please wait.</b></blockquote>",
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML" });

      await this.run("yt-dlp", args);

      const file = fs.readdirSync(CONFIG.TMP_DIR).find(f => f.startsWith(base));
      if (!file) throw new Error("File not found");
      const filePath = path.join(CONFIG.TMP_DIR, file);

      if (type === "video") {
        await bot.sendChatAction(chatId, "upload_video");
        await bot.sendVideo(chatId, filePath, {
          supports_streaming: true,
          caption: UserInterface.formatCaption(video, "🎬"),
          parse_mode: "HTML"
        });
      } else {
        await bot.sendChatAction(chatId, "upload_audio");
        await bot.sendAudio(chatId, filePath, {
          title: video.title,
          performer: video.channel,
          caption: UserInterface.formatCaption(video, "🎵"),
          parse_mode: "HTML"
        });
      }

      fs.unlinkSync(filePath);
      await bot.deleteMessage(chatId, messageId);
    } catch (e) {
      console.error(e);
      await bot.editMessageText(`❌ Download failed\n\nPossible causes:\n• File exceeds platform limits\n• Video is private or restricted\n• Temporary server failure\n\nPlease try another link.`, { chat_id: chatId, message_id: messageId });
    }
  }
}

class SessionManager {
  constructor() {
    this.flowMap = new Map();
    this.activeLocks = new Set();
    this.startCleanup();
  }

  create(chatId, messageId, data) {
    this.flowMap.set(this.key(chatId, messageId), { ...data, createdAt: Date.now() });
  }

  get(chatId, messageId) {
    return this.flowMap.get(this.key(chatId, messageId));
  }

  delete(chatId, messageId) {
    const key = this.key(chatId, messageId);
    this.flowMap.delete(key);
    this.activeLocks.delete(key);
  }

  lock(chatId, messageId) {
    const key = this.key(chatId, messageId);
    if (this.activeLocks.has(key)) return false;
    this.activeLocks.add(key);
    return true;
  }

  unlock(chatId, messageId) {
    this.activeLocks.delete(this.key(chatId, messageId));
  }

  key(chatId, messageId) {
    return `${chatId}:${messageId}`;
  }

  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.flowMap) {
        if (now - v.createdAt > CONFIG.CLEANUP_INTERVAL) this.flowMap.delete(k);
      }
    }, CONFIG.CLEANUP_INTERVAL);
  }
}

class UserInterface {
  static get lang() {
    return {
      usage:
        "<blockquote>⛩️ <b>YouTube Downloader Guide</b></blockquote>\n\n" +

        "<blockquote>" +
        "Send a YouTube link or video name to download.\n\n" +

        "<b>Commands</b>\n" +
        "• /ytb &lt;name or link&gt; → Choose Video or Audio\n" +
        "• /ytb -v &lt;name or link&gt; → Download Video\n" +
        "• /ytb -a &lt;name or link&gt; → Download Audio (MP3)\n" +
        "• /ytb -l &lt;name or link&gt; → Show Video Info\n\n" +

        "<b>Examples</b>\n" +
        "• /ytb Never gonna give you up\n" +
        "• /ytb -v https://youtu.be/dQw4w9WgXcQ\n" +
        "• /ytb -a Shape of You\n" +
        "• /ytb -l https://youtu.be/dQw4w9WgXcQ" +
        "</blockquote>",
      error: "❌ Failed to process your request.\n\nPossible causes:\n• Invalid or unsupported link\n• Temporary YouTube blocking\n• Network instability\n\nPlease try again later.",
      notFound: "No results found. Please verify the title or try a different query."
    };
  }

  static formatInfo(v) {
    return (
      "<blockquote>⛩️ <b>YouTube Media Info</b></blockquote>\n\n" +
      "<blockquote>" +
      "<b>❏ Title</b>\n" +
      `${this.escape(v.title)}\n\n` +
      "<b>❏ Duration</b>\n" +
      `${v.duration}\n\n` +
      "<b>❏ Channel</b>\n" +
      `${this.escape(v.channel)}` +
      "</blockquote>"
    );
  }


  static formatList(items) {
    return (
      "<blockquote>⛩️ <b>YouTube Search Results</b></blockquote>\n\n" +
      items.slice(0, 9).map((x, i) =>
        "<blockquote>" +
        `<b>${i + 1}.</b> ${this.escape(x.title)}\n` +
        `● ${x.duration} ● ${this.escape(x.channel)}` +
        "</blockquote>"
      ).join("\n\n")
    );
  }


  static formatCaption(v) {
    return (
      "<blockquote>" +
      "<b>❏ Title</b>\n" +
      `${this.escape(v.title)}\n\n` +
      "<b>❏ Duration</b>\n" +
      `${v.duration}\n\n` +
      "<b>❏ Channel</b>\n" +
      `${this.escape(v.channel)}` +
      "</blockquote>"
    );
  }

  static formatLinkInfo(v) {
    return (
      "<blockquote>⛩️ <b>YouTube Media Info</b></blockquote>\n\n" +
      "<blockquote>" +
      "<b>❏ Title</b>\n" +
      `${this.escape(v.title)}\n\n` +
      "<b>❏ Duration</b>\n" +
      `${v.duration}\n\n` +
      "<b>❏ Channel</b>\n" +
      `${this.escape(v.channel)}\n\n` +
      "<b>❏ URL</b>\n" +
      `<a href="${v.url}">${v.url}</a>\n\n` +
      "<b>❏ Thumbnail</b>\n" +
      `<a href="${v.thumbnail}">Open preview</a>` +
      "</blockquote>"
    );
  }

  static get actionButtons() {
    return {
      inline_keyboard: [
        [
          { text: "🎵 Audio", callback_data: "ytb:audio" },
          { text: "🎬 Video", callback_data: "ytb:video" },
          { text: "🔗 Link", callback_data: "ytb:link" }
        ],
        [{ text: "⬅ Back", callback_data: "ytb:back" }]
      ]
    };
  }

  static resultButtons(count) {
    const rows = [];
    let row = [];
    for (let i = 0; i < Math.min(9, count); i++) {
      row.push({ text: `${i + 1}`, callback_data: `ytb:pick:${i}` });
      if (row.length === 3) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length) rows.push(row);
    return { inline_keyboard: rows };
  }

  static escape(text = "") {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

/* ================= INSTANCES ================= */

const ytService = new YouTubeService();
const session = new SessionManager();

/* ================= MODULE EXPORT ================= */

module.exports = {
  name: "ytb",
  version: 4.0,
  longDescription: "YouTube downloader powered by yt-dlp engine",
  shortDescription: "Professional YouTube downloader",
  guide: "{pn} [-v|-a|-l] <query|link>",
  category: ["Download", 4],
  lang: UserInterface.lang,

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!args.length) return bot.sendMessage(chatId, UserInterface.lang.usage,
      { parse_mode: "HTML" }
    );

    let mode = "ask";
    let query = args.join(" ");

    // Argument parsing
    if (["-v", "video"].includes(args[0])) { mode = "video"; query = args.slice(1).join(" "); }
    else if (["-a", "audio"].includes(args[0])) { mode = "audio"; query = args.slice(1).join(" "); }
    else if (["-l", "link"].includes(args[0])) { mode = "link"; query = args.slice(1).join(" "); }

    if (!query) return bot.sendMessage(chatId, UserInterface.lang.usage,
      { parse_mode: "HTML" }
    );

    // Process Request
    const result = await ytService.search(query);

    if (!result) return bot.sendMessage(chatId, UserInterface.lang.error,
      { parse_mode: "HTML" }
    );
    if (result.type === 'search' && !result.data.length) return bot.sendMessage(chatId, UserInterface.lang.notFound,
      { parse_mode: "HTML" }
    );

    // Prepare Output
    const isDirect = result.type === 'direct';
    const data = isDirect ? [result.data] : result.data;
    const text = isDirect ? UserInterface.formatInfo(data[0]) : UserInterface.formatList(data);
    const keyboard = isDirect
      ? (mode === "ask" ? UserInterface.actionButtons : null)
      : UserInterface.resultButtons(data.length);

    await bot.sendChatAction(chatId, "typing");

    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
      disable_web_page_preview: true
    });

    // Save State
    session.create(chatId, sent.message_id, {
      mode,
      queryType: result.type,
      results: data,
      selectedIndex: isDirect ? 0 : null,
      userId
    });

    // Auto-Action for Direct Links
    if (isDirect && mode !== "ask") {
      if (mode === "link") {
        await bot.editMessageText(UserInterface.formatLinkInfo(data[0]),
          {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
            disable_web_page_preview: true
          }
        );
        session.delete(chatId, sent.message_id);
      } else {
        await ytService.download(data[0], mode, userId, sent.message_id, bot, chatId);
      }
    }
  },

  onCallback: async ({ bot, callbackQuery, params }) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (!session.lock(chatId, messageId)) return bot.answerCallbackQuery(callbackQuery.id);

    const flow = session.get(chatId, messageId);
    if (!flow) {
      session.unlock(chatId, messageId);
      return bot.answerCallbackQuery(callbackQuery.id);
    }

    try {
      await bot.answerCallbackQuery(callbackQuery.id);
      const [action, indexStr] = params;

      if (action === "pick") {
        flow.selectedIndex = parseInt(indexStr);
        if (flow.mode === "ask") {
          await bot.editMessageText(UserInterface.formatInfo(flow.results[flow.selectedIndex]), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: UserInterface.actionButtons
          });
        } else {
          await ytService.download(flow.results[flow.selectedIndex], flow.mode, flow.userId, messageId, bot, chatId);
        }
      } else if (["audio", "video", "link"].includes(action)) {
        const video = flow.results[flow.selectedIndex];
        if (action === "link") {
          await bot.editMessageText(UserInterface.formatLinkInfo(video),
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "HTML",
              disable_web_page_preview: true
            }
          );
          session.delete(chatId, messageId);
          return;
        }
        await ytService.download(video, action, flow.userId, messageId, bot, chatId);
      } else if (action === "back") {
        await bot.editMessageText(UserInterface.formatList(flow.results), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: UserInterface.resultButtons(flow.results.length)
        });
      }
    } finally {
      session.unlock(chatId, messageId);
    }
  }
};
const { spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

/* ================= CONFIG ================= */

const TMP_DIR = path.join(__dirname, "../downloads");
const COOKIE_FILE = path.join(__dirname, "../yt.txt");
const TG_LIMIT = 50 * 1024 * 1024; // 50MB

// TEMPORARY PYTHON WRAPPER FOR yt-dlp
const YTDLP_BIN = "python3.12";
const YTDLP_PREFIX = ["-m", "yt_dlp"];

/* ========================================== */

fs.ensureDirSync(TMP_DIR);

// message scoped state
const flowMap = new Map();
const activeLocks = new Set();

// cleanup memory every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of flowMap) {
    if (now - v.createdAt > 10 * 60 * 1000) flowMap.delete(k);
  }
}, 10 * 60 * 1000);

module.exports = {
  name: "ytb",
  version: 3.1,
  longDescription: "YouTube downloader powered by yt-dlp engine",
  shortDescription: "Professional YouTube downloader",
  guide: "{pn} [-v|-a|-l] <query|link>",
  category: ["Download", 4],

  lang: {
    usage:
      "Usage:\n/ytb <query|link>\n/ytb -v <query|link>\n/ytb -a <query|link>\n/ytb -l <query|link>",
    error: "❌ Failed to process request.",
    notFound: "No results found."
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!args.length)
      return bot.sendMessage(chatId, module.exports.lang.usage);

    let mode = "ask";
    let query = args.join(" ");

    if (["-v", "video"].includes(args[0])) {
      mode = "video";
      query = args.slice(1).join(" ");
    } else if (["-a", "audio"].includes(args[0])) {
      mode = "audio";
      query = args.slice(1).join(" ");
    } else if (["-l", "link"].includes(args[0])) {
      mode = "link";
      query = args.slice(1).join(" ");
    }

    if (!query)
      return bot.sendMessage(chatId, module.exports.lang.usage);

    // direct link
    if (query.startsWith("http")) {
      const info = await getInfo(query, true);
      if (!info) return bot.sendMessage(chatId, module.exports.lang.error);

      const text = formatInfo(info);
      const keyboard = mode === "ask" ? formatButtons() : null;

      const sent = await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

      flowMap.set(flowKey(chatId, sent.message_id), {
        mode,
        queryType: "direct",
        results: [info],
        selectedIndex: 0,
        userId,
        createdAt: Date.now()
      });
      return;
    }

    // search
    const results = await searchYT(query);
    if (!results.length)
      return bot.sendMessage(chatId, module.exports.lang.notFound);

    const text = formatInfo(results[0], true, results);
    const keyboard = resultButtons(results.length);

    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });

    flowMap.set(flowKey(chatId, sent.message_id), {
      mode,
      queryType: "search",
      results,
      selectedIndex: null,
      userId,
      createdAt: Date.now()
    });
  },

  onCallback: async ({ bot, callbackQuery, params }) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const key = flowKey(chatId, messageId);

    if (activeLocks.has(key)) return bot.answerCallbackQuery(callbackQuery.id);
    const flow = flowMap.get(key);
    if (!flow) return bot.answerCallbackQuery(callbackQuery.id);

    const [action, indexStr] = params;

    activeLocks.add(key);
    await bot.answerCallbackQuery(callbackQuery.id);

    try {
      if (action === "pick") {
        flow.selectedIndex = parseInt(indexStr);
        if (flow.mode === "ask") {
          await bot.editMessageText(
            formatInfo(flow.results[flow.selectedIndex]),
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: formatButtons()
            }
          );
        } else {
          await startDownload(bot, chatId, messageId, flow, flow.mode);
        }
      }

      if (["audio", "video", "link"].includes(action)) {
        if (action === "link") {
          const url = flow.results[flow.selectedIndex].url;
          await bot.editMessageText(`🔗 ${url}`, {
            chat_id: chatId,
            message_id: messageId
          });
          cleanup(key);
          return;
        }
        await startDownload(bot, chatId, messageId, flow, action);
      }

      if (action === "back") {
        await bot.editMessageText(
          formatInfo(flow.results[0], true, flow.results),
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: resultButtons(flow.results.length)
          }
        );
      }
    } finally {
      activeLocks.delete(key);
    }
  }
};

/* ================= CORE ================= */

function flowKey(chatId, messageId) {
  return `${chatId}:${messageId}`;
}

function cleanup(key) {
  flowMap.delete(key);
  activeLocks.delete(key);
}

function formatInfo(v, list = false, all = []) {
  if (list) {
    return all
      .slice(0, 6)
      .map(
        (x, i) =>
          `*${i + 1}.* ${x.title}\n⏱ ${x.duration} | 📺 ${x.channel}`
      )
      .join("\n\n");
  }
  return `*${v.title}*\n⏱ ${v.duration} | 📺 ${v.channel}`;
}

function resultButtons(count) {
  const rows = [];
  let row = [];
  for (let i = 0; i < Math.min(6, count); i++) {
    row.push({ text: `${i + 1}`, callback_data: `ytb:pick:${i}` });
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return { inline_keyboard: rows };
}

function formatButtons() {
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

/* ============== PROCESS WRAPPER ============== */

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const finalCmd = cmd === "yt-dlp" ? YTDLP_BIN : cmd;
    const finalArgs =
      cmd === "yt-dlp" ? [...YTDLP_PREFIX, ...args] : args;

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

/* ============== yt-dlp HELPERS ============== */

async function searchYT(query) {
  const raw = await run("yt-dlp", [
    `ytsearch6:${query}`,
    "-J",
    "--cookies",
    COOKIE_FILE,
    "--remote-components",
    "ejs:github"
  ]);
  const json = JSON.parse(raw);
  return json.entries
    .filter(v => !v.is_live)
    .map(v => ({
      id: v.id,
      title: v.title,
      duration: v.duration_string || "N/A",
      channel: v.uploader,
      url: v.webpage_url,
      thumbnail: v.thumbnail
    }));
}

async function getInfo(url, allowPlaylist = false) {
  const args = ["-J", "--cookies", COOKIE_FILE, "--remote-components", "ejs:github"];
  if (!allowPlaylist) args.push("--no-playlist");

  const raw = await run("yt-dlp", args.concat(url));
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
}

/* ============== DOWNLOAD PIPELINE ============== */

async function startDownload(bot, chatId, messageId, flow, type) {
  const video = flow.results[flow.selectedIndex];
  const safeTitle = video.title.replace(/[^\w\d-_ ]/g, "");
  const base = `${flow.userId}-${messageId}-${safeTitle}-${video.id}`;
  const out = path.join(TMP_DIR, `${base}.%(ext)s`);

  await bot.editMessageText("⬇️ Downloading...", {
    chat_id: chatId,
    message_id: messageId
  });

  try {
    if (type === "video") {
      await run("yt-dlp", [
        video.url,
        "--cookies",
        COOKIE_FILE,
        "--remote-components",
        "ejs:github",
        "-f",
        `bv*[ext=mp4][filesize_approx<${TG_LIMIT}]+ba/b[ext=mp4][filesize_approx<${TG_LIMIT}]/bv*+ba/b[filesize_approx<${TG_LIMIT}]/b`,
        "-o",
        out,
        "--merge-output-format",
        "mp4"
      ]);
    }

    if (type === "audio") {
      await run("yt-dlp", [
        video.url,
        "--cookies",
        COOKIE_FILE,
        "--remote-components",
        "ejs:github",
        "-f",
        `bestaudio[filesize_approx<${TG_LIMIT}]/bestaudio`,
        "-x",
        "--audio-format",
        "mp3",
        "--embed-thumbnail",
        "--add-metadata",
        "-o",
        out
      ]);
    }

    const file = fs.readdirSync(TMP_DIR).find(f => f.startsWith(base));
    const filePath = path.join(TMP_DIR, file);

    if (type === "video")
      await bot.sendVideo(chatId, filePath, { supports_streaming: true });
    else
      await bot.sendAudio(chatId, filePath, {
        title: video.title,
        performer: video.channel
      });

    fs.unlinkSync(filePath);
    await bot.deleteMessage(chatId, messageId);
  } catch (e) {
    console.error(e);
    await bot.editMessageText("❌ Download failed.", {
      chat_id: chatId,
      message_id: messageId
    });
  }
}

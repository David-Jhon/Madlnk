const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

/**
 * URL validator used by Imgbb uploader
 */
const regCheckURL =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

/* ============================================================
 *                    PROGRESS ENGINE CORE
 * ============================================================
 * This module provides a global progress message system for any
 * long-running operation (uploads, downloads, processing).
 *
 * Features:
 *  - Live progress bar
 *  - Speed calculation
 *  - ETA calculation
 *  - Throttled updates (anti-flood)
 *  - Clean HTML formatted UI
 * ============================================================
 */

/**
 * Stores last update timestamps for throttling message edits.
 * Key format: "chatId:messageId"
 */
const lastUpdateMap = new Map();

/**
 * Stores start timestamps for each progress session.
 * Used to calculate speed and ETA.
 */
const startTimeMap = new Map();

/**
 * Generates a text progress bar using block characters.
 * Example: ■■■■■□□□□□□□
 *
 * @param {number} percent - Completion percentage (0–100)
 * @param {number} size - Total bar length
 * @returns {string}
 */
function makeProgressBar(percent, size = 12) {
  const filled = Math.floor(percent / (100 / size));
  const empty = size - filled;
  return "■".repeat(filled) + "□".repeat(empty);
}

/**
 * Converts bytes into a human-readable string.
 *
 * @param {number} bytes
 * @returns {string}
 */
function convertBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

/**
 * Converts seconds into HH:MM:SS format.
 *
 * @param {number} seconds
 * @returns {string}
 */
function convertTime(seconds) {
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

/**
 * Creates or updates a live progress message in Telegram.
 *
 * This function is safe for high-frequency updates because:
 *  - It throttles edits to once every 7 seconds
 *  - It calculates speed and ETA in real time
 *
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {Object} options
 * @param {string} options.title - Task title (e.g. "Uploading File")
 * @param {string} options.status - Current status text
 * @param {number} options.current - Bytes processed
 * @param {number} options.total - Total bytes
 * @param {number} [options.messageId] - Existing progress message ID
 * @param {number} [options.replyToId] - Message to reply to if new
 *
 * @returns {Promise<number>} Telegram message ID
 */
const updateProgressMessage = async (bot, chatId, options) => {
  const {
    title,
    status,
    current = 0,
    total = 0,
    messageId,
    replyToId
  } = options;

  const key = `${chatId}:${messageId || "new"}`;
  const now = Date.now();

  /* ---------- Throttling Logic ---------- */

  const last = lastUpdateMap.get(key) || 0;

  // Only update every 7 seconds unless task is finished
  if (now - last < 1500 && current !== total) {
    return messageId;
  }

  lastUpdateMap.set(key, now);

  /* ---------- Timing Initialization ---------- */

  if (!startTimeMap.has(key)) {
    startTimeMap.set(key, now);
  }

  const start = startTimeMap.get(key);
  const diff = (now - start) / 1000;

  /* ---------- Progress Calculations ---------- */

  const percent = total
    ? Math.min((current / total) * 100, 100).toFixed(2)
    : 0;

  const speed = diff > 0 ? current / diff : 0;
  const eta = speed > 0 ? (total - current) / speed : 0;

  const bar = makeProgressBar(percent);

  /* ---------- Telegram Message Layout ---------- */

  const messageText = `
<blockquote>‣ <b>Task :</b> <b><i>${title}</i></b></blockquote>

<blockquote>‣ <b>Status :</b> <i>${status}</i>
<code>[${bar}]</code> ${percent}%</blockquote>

<blockquote>‣ <b>Progress :</b> ${convertBytes(current)} / ${convertBytes(total)}
‣ <b>Speed :</b> ${convertBytes(speed)}/s
‣ <b>Elapsed :</b> ${convertTime(diff)}
‣ <b>ETA :</b> ${convertTime(eta)}</blockquote>
`;

  /* ---------- Send or Edit Message ---------- */

  try {
    if (messageId) {
      await bot.editMessageText(messageText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML"
      });
      return messageId;
    } else {
      const message = await bot.sendMessage(chatId, messageText, {
        parse_mode: "HTML",
        reply_to_message_id: replyToId
      });
      return message.message_id;
    }
  } catch (error) {
    // Ignore harmless edit errors (message not modified, etc.)
    if (error.response && error.response.statusCode !== 400) {
      console.error("Error updating progress message:", error.message);
    }
    return messageId;
  }
};

/**
 * Deletes a progress message and cleans internal memory.
 *
 * @param {Object} bot
 * @param {number} chatId
 * @param {number} progressMessageId
 */
const deleteProgressMessage = async (bot, chatId, progressMessageId) => {
  if (!progressMessageId) return;

  const key = `${chatId}:${progressMessageId}`;

  // Prevent memory leaks
  lastUpdateMap.delete(key);
  startTimeMap.delete(key);

  try {
    await bot.deleteMessage(chatId, progressMessageId);
  } catch (error) {
    if (error.response && error.response.statusCode !== 404) {
      console.error("Error deleting progress message:", error.message);
    }
  }
};

/* ============================================================
 *                       IMGBB UPLOADER
 * ============================================================
 * Uploads a file or URL to imgbb.com and returns upload metadata
 * ============================================================
 */

async function uploadImgbb(source, filename) {
  try {
    const isUrl = typeof source === "string" && regCheckURL.test(source);

    if (!source)
      throw new Error("A file buffer, stream, or URL must be provided.");

    if (!isUrl && !Buffer.isBuffer(source) && typeof source._read !== "function") {
      throw new Error("The source must be a valid URL, buffer, or readable stream.");
    }

    // Fetch dynamic upload token from imgbb homepage
    const res_ = await axios.get("https://imgbb.com");
    const auth_token = res_.data.match(/auth_token="([^"]+)"/)[1];

    if (!auth_token)
      throw new Error("Could not retrieve auth_token from imgbb.com");

    const form = new FormData();

    if (isUrl) {
      form.append("source", source);
    } else {
      form.append("source", source, { filename: filename || "image.png" });
    }

    form.append("type", isUrl ? "url" : "file");
    form.append("action", "upload");
    form.append("timestamp", Date.now());
    form.append("auth_token", auth_token);

    const res = await axios.post("https://imgbb.com/json", form, {
      headers: { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (res.data?.status_code && res.data.status_code !== 200) {
      throw new Error(res.data.error?.message || "Unknown error from Imgbb");
    }

    return res.data;
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message;
    throw new Error(`Imgbb upload failed: ${errorMessage}`);
  }
}

module.exports = {
  updateProgressMessage,
  deleteProgressMessage,
  uploadImgbb
};

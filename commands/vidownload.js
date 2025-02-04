const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "vidownload",
  version: 1.0,
  longDescription: "Download videos or audios from various sources. Supports additional parameters for file size, format, and cookies.",
  shortDescription: "Download videos/audio",
  guide: `{pn} <url> | [[optional parameters]]`+
  `\n\n─── Examples:
    \n• {pn} https://example.com/video --fs 100 --type audio --c cookies.txt
     \n• {pn} https://example.com/video --maxsize 200 --format video
     \n• {pn} https://example.com/video`+
     `\n\n─── params:
     \n• URL: The video or audio URL to download
     \n• --fs or --maxsize: Specify maximum file size in MB (optional)
     \n• --type or --format: Specify download type as 'video' or 'audio' (optional)
     \n• --c or --cookie: Path to a cookie file to include in the request (optional)`,
  category: ['Download', 4],
  lang: {
    syntaxError: "The command you are using is wrong syntax, please type %1help %2 to see the details of how to use this command",
    loading: "🔄 Downloading...",
    invalid_url: "❌ Please provide a valid URL to download.",
    error: "❌ Failed to download the media. Please try again."
  },

  parseArgs(args) {
    const params = {};
    args.forEach((arg, i) => {
      if (arg.startsWith("--")) {
        const key = arg.slice(2).toLowerCase();
        const value = args[i + 1];

        switch (key) {
          case "maxsize":
          case "ms":
          case "fs":
            if (!isNaN(Number(value))) params.filesize = Number(value);
            break;

          case "type":
          case "format":
          case "media":
          case "f":
            if (["video", "audio"].includes(value.toLowerCase())) {
              params.format = value.toLowerCase();
            }
            break;

          case "cookie":
          case "cookies":
          case "c":
            const cookiePath = path.join(process.cwd(), value);
            if (fs.existsSync(cookiePath)) {
              params.cookies = fs.readFileSync(cookiePath, 'utf-8');
            }
            break;

          default:
            break;
        }
      }
    });
    return params;
  },

  async download(bot, vuri, params, chatId, downloadingMsgId) {
    try {
      const reqBody = {
        url: vuri,
        ...(params.format && { format: params.format }),
        ...(params.filesize && { filesize: params.filesize }),
        ...(params.cookies && { cookies: params.cookies })
      };
      console.log("Sending request to API with body:", reqBody);

      const d = (await axios.get(`${process.env.TANPIR_API}`)).data.megadl;
      const res = await axios.post(d, reqBody);
      const data = res.data;

      const mediaStream = await axios.get(data.url, { responseType: 'stream' });
      const filename = `${data.title}.${params.format === 'audio' ? 'mp3' : 'mp4'}`;

      const contentLength = mediaStream.headers['content-length'];
      const fileSizeInMB = contentLength ? (contentLength / (1024 * 1024)).toFixed(2) : 0;

      if (fileSizeInMB > 50) {
        await bot.sendMessage(chatId, `The file is too large to send (${fileSizeInMB} MB). Here is the stream URL:\n\n${data.url}`);
      } else {
        if (params.format === 'audio') {
          await bot.sendAudio(chatId, mediaStream.data, {
            caption: `• ${data.title}\n• Duration: ${data.duration}\n• Upload Date: ${data.upload_date || "--"}\n• Source: ${data.source}\n\n• Stream: ${data.url}`
          });
        } else {
          await bot.sendVideo(chatId, mediaStream.data, {
            caption: `• ${data.title}\n• Duration: ${data.duration}\n• Upload Date: ${data.upload_date || "--"}\n• Source: ${data.source}\n\n• Stream: ${data.url}`
          });
        }
      }

      await bot.deleteMessage(chatId, downloadingMsgId);
    } catch (e) {
      console.error("Download Err:", e.response?.data || e.message);
      bot.sendMessage(chatId, this.lang.error);
    }
  },

  async onStart({ bot, msg, args }) {
    const chatId = msg.chat.id;
    const text = args.join(" ");

    if (!args.length || !/^https?:\/\//.test(text)) {
        return bot.sendMessage(chatId, this.lang.syntaxError.replace("%1", "/").replace("%2", this.name));
  }
      const vuri = text.split(' ')[0];
      const params = this.parseArgs(text.split(' '));

      const downloadingMsg = await bot.sendMessage(chatId, this.lang.loading);
      const downloadingMsgId = downloadingMsg.message_id;

      this.download(bot, vuri, params, chatId, downloadingMsgId);
    }
  }

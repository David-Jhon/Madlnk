const axios = require('axios');
const fs = require('fs-extra');

const urlRegex = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w|-]{11})(?:\S+)?$/;

const searchSessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of searchSessions) {
    if (now - session.timestamp > 15 * 60 * 1000) {
      searchSessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  name: 'ytb',
  version: 1.0,
  longDescription: 'Search, download, and retrieve YouTube videos, audio, or links directly from Telegram',
  shortDescription: 'YouTube downloader and search',
  guide: "{pn} <-v | -a | -l> <video link|query>"+
    "\n\n─── Usage:"+
    "\n{pn} [[video | -v]] [[<video name> | <video link>]]: use to download video from YouTube." +
    "\n\n{pn} [[audio | -a]] [[<video name> | <video link>]]: use to download audio from YouTube" +
    "\n\n{pn} [[link | -l] [[<video name> | <video link>]]: use to get link of a video on YouTube" +
    "\n\n─── Example:" +
    "\n{pn} -v Never Gonna Give You Up!" +
    "\n{pn} -a Never Gonna Let You Down" +
    "\n{pn} -l We Are On The Cruise!!!",
  category: ['Download', 4],
  lang: {
    syntaxError: "The command you are using is wrong syntax, please type %1help %2 to see the details of how to use this command",
    usage: 'Usage: /ytb [video|-v] [query|url]\n/ytb [audio|-a] [query|url]\n/ytb [link|-l] [query|url]',
    error: 'An error occurred while processing your request.',
    notFound: 'No results found.',
    downloading: '⏳ Downloading {type}...',
    select: '*Select a video:*'
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id.toString();
    
    if (!args.length) {
      return bot.sendMessage(chatId, module.exports.lang.usage);
    }

    const typeMap = {
      '-v': 'video', 'video': 'video',
      '-a': 'audio', 'audio': 'audio',
      '-l': 'link', 'link': 'link'
    };

    if (!typeMap[args[0]]) {
      return bot.sendMessage(chatId, module.exports.lang.usage);
    }

    const type = typeMap[args[0]];
    const query = args.slice(1).join(' ');
    if (!query) return bot.sendMessage(chatId, '🔍 Please provide a search query or URL');

    if (urlRegex.test(query)) {
      const url = query.match(urlRegex)[0];
      if (type === 'link') return bot.sendMessage(chatId, `🔗 YouTube Link:\n${url}`);
      return processDownload(bot, chatId, type, url);
    }

    const results = await searchYT(query);
    if (!results.length) return bot.sendMessage(chatId, module.exports.lang.notFound);

    searchSessions.set(chatId, { results, type, timestamp: Date.now() });

    const mediaGroup = results.slice(0, 5).map((result, index) => ({
      type: 'photo',
      media: result.thumbnail,
      caption: `*${index + 1}*. ${result.title}\n⏱ ${result.time} | 📺 ${result.channel.name}`,
      parse_mode: 'Markdown'
    }));
    
    await bot.sendMediaGroup(chatId, mediaGroup);
    const keyboard = results.slice(0, 5).map((result, index) => [{
      text: `${index + 1}. ${result.title.slice(0, 45)}...`,
      callback_data: `ytb:${chatId}:${index}`
    }]);

    const detailedList = results.slice(0, 5).map((result, index) =>
      `*${index + 1}*. ${result.title}\n⏱ ${result.time} | 📺 ${result.channel.name}`
    ).join('\n\n');

    const messageText = `${module.exports.lang.select}\n\n${detailedList}`;

    await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
  },

  onCallback: async ({ bot, callbackQuery, params }) => {
    const chatId = callbackQuery.message.chat.id.toString();
    const [originalChatId, indexStr] = params;
    const index = parseInt(indexStr);

    await bot.answerCallbackQuery(callbackQuery.id);
    if (isNaN(index) || index < 0 || index > 4) return bot.sendMessage(chatId, '⚠️ Invalid selection index');
    
    const session = searchSessions.get(originalChatId);
    if (!session?.results?.[index]) return bot.sendMessage(chatId, '⏳ Session expired. Please search again.');
    
    return processDownload(bot, chatId, session.type, `https://youtu.be/${session.results[index].id}`);
  }
};

async function processDownload(bot, chatId, type, url) {
  if (type === 'link') {
    return bot.sendMessage(chatId, `🔗 YouTube Link:\n${url}`);
  }

  const processingMsg = await bot.sendMessage(chatId, module.exports.lang.downloading.replace('{type}', type));
  try {
    const data = await downloadYT(type, url);
    await sendResult(bot, chatId, type, data);
    await bot.deleteMessage(chatId, processingMsg.message_id);
  } catch (error) {
    await bot.editMessageText(`❌ Error: ${error.message}`, { chat_id: chatId, message_id: processingMsg.message_id });
  }
}

async function sendResult(bot, chatId, type, data) {
  try {
    if (type === 'video') {
      await bot.sendVideo(chatId, data.url, {
        caption: `🎬 ${data.title}\n⏱ Duration: ${data.duration}\n📅 Upload Date: ${data.upload_date}\n🔗 Stream: ${data.url}`,
        supports_streaming: true
      });
    } else if (type === 'audio') {
      
      await bot.sendAudio(chatId, data.url, {
        caption: `🎬 ${data.title}\n⏱ Duration: ${data.duration}\n📅 Upload Date: ${data.upload_date}\n🔗 Stream: ${data.url}`,
        title: data.title,
        performer: 'YouTube',
        thumb: data.thumb,
        filename: `${data.title}.mp3`
      });
    }
  } catch (error) {
    console.error("sendResult error:", error);
    throw new Error('Failed to send media');
  }
}

async function downloadYT(type, url) {
  try {
    const endpoint = (await axios.get(`${process.env.TANPIR_API}`)).data.yt;
    const { data } = await axios.post(endpoint, {
      url,
      filesize: type === 'audio' ? 20 : 34,
      format: type,
      cookies: fs.readFileSync('yt.txt', 'utf-8') || ''
    });
    if (!data?.url) throw new Error('Invalid response from download service');
    return data;
  } catch (error) {
    throw new Error('Failed to process media download');
  }
}

async function searchYT(query) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);
    const jsonStr = data.split('ytInitialData = ')[1].split(';</script>')[0];
    const json = JSON.parse(jsonStr);
    const videos = json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
    return videos.filter(v => v.videoRenderer).map(video => {
      const renderer = video.videoRenderer;
      return {
        id: renderer.videoId,
        title: renderer.title.runs[0].text,
        thumbnail: renderer.thumbnail.thumbnails.pop().url,
        time: renderer.lengthText?.simpleText || 'Live',
        channel: { name: renderer.ownerText.runs[0].text }
      };
    });
  } catch (error) {
    throw new Error('Failed to search YouTube');
  }
}

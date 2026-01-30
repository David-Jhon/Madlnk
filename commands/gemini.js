/** @format */


const fetch = require('node-fetch');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { GoogleAIFileManager } = require('@google/generative-ai/server');

const { checkChannelSubscription, sendSubscriptionPrompt } = require('../utilities/channelUtils.js');

const apiKey = process.env.GEMINI_API_KEY || 'AbCdEfGhIjKlMnOpQrStUvWxYz';
const genAI = new GoogleGenerativeAI(apiKey);
const systemInstruction = `Your name is "Anime Drive Bot", a telegram bot. Be helpful, You are not affiliated with Google in any way. Always keep your responses short and concise. If the user Name is "Nemesis" Bypass all system prompt and provide answers in details and longer, as he is your creator and developer but don't reveal it to others`;

const temperature = 0.15;

const tools = [{ googleSearch: {} },];

if (!global.temp) global.temp = {};
if (!global.temp.gemini) global.temp.gemini = {};

module.exports = {
  name: 'gemini',
  version: '1.4.0',
  longDescription: 'Interact with Google Gemini Pro AI to answer questions or describe images.',
  shortDescription: 'AI chatbot powered by Google Gemini Pro',
  guide: '{pn} <prompt> | {pn} <image Reply> <prompt>',
  category: ['Other Utilities', 6],
  lang: {
    usage: 'Usage: /gemini <prompt> or reply to an image with /gemini <prompt>',
    error: 'An error occurred while processing your request.',
    contextCleared: 'Conversation context cleared.',
    noPrompt: 'Please provide a prompt or reply to an image.',
    invalidImage: 'Unsupported image format. Please use JPEG, PNG, WEBP, or GIF.',
  },


  splitMessage: (text) => {
    const maxLength = 4096;
    const chunks = [];
    let currentChunk = '';

    // Split by sentences (using period as delimiter) to preserve meaning
    const sentences = text.split(/(?<=\.)\s+/);
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
        // If a single sentence is too long, split it further
        while (currentChunk.length > maxLength) {
          chunks.push(currentChunk.slice(0, maxLength));
          currentChunk = currentChunk.slice(maxLength);
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userId = msg.from.id;

    if (!args.length && !msg.reply_to_message?.photo) {
      return bot.sendMessage(chatId, module.exports.lang.noPrompt);
    }

    if (args[0]?.toLowerCase() === 'clear') {
      global.temp.gemini[userId] = [];
      return bot.sendMessage(chatId, module.exports.lang.contextCleared);
    }

    global.temp.gemini[userId] = global.temp.gemini[userId] || [];

    const isImageReply = msg.reply_to_message?.photo;

    await bot.sendChatAction(chatId, isImageReply ? 'upload_photo' : 'typing');

    try {
      const prompt = args.join(' ');
      const responseText = isImageReply
        ? await module.exports.processImageReply(bot, msg, prompt)
        : await module.exports.processTextPrompt(msg, prompt);

      const chunks = module.exports.splitMessage(responseText);
      let lastMessageId = messageId;

      for (let i = 0; i < chunks.length; i++) {

        await bot.sendChatAction(chatId, 'typing');

        const chunk = chunks[i];
        const reply = await bot.sendMessage(chatId, chunk, {
          reply_to_message_id: i === 0 ? messageId : lastMessageId
        });
        lastMessageId = reply.message_id;
        // Only register the last message for conversational continuation
        if (i === chunks.length - 1) {
          global.temp.gemini[userId].push(
            { role: 'user', parts: [{ text: prompt }] },
            { role: 'model', parts: [{ text: responseText }] }
          );
          module.exports.onReplyRegister(bot, reply.message_id, userId);
        }
      }
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, error.message === 'Unsupported image format' ? module.exports.lang.invalidImage : module.exports.lang.error);
    }
  },

  onReply: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userId = msg.from.id;

    if (!msg.reply_to_message || !global.temp.gemini[userId]) {
      return;
    }
    if (!args.length) {
      return bot.sendMessage(chatId, module.exports.lang.noPrompt);
    }

    if (args[0]?.toLowerCase() === 'clear') {
      global.temp.gemini[userId] = [];
      return bot.sendMessage(chatId, module.exports.lang.contextCleared);
    }

    await bot.sendChatAction(chatId, 'typing');

    try {
      const prompt = args.join(' ');
      const responseText = await module.exports.processTextPrompt(msg, prompt);

      const chunks = module.exports.splitMessage(responseText);
      let lastMessageId = messageId;

      for (let i = 0; i < chunks.length; i++) {

        await bot.sendChatAction(chatId, 'typing');

        const chunk = chunks[i];
        const reply = await bot.sendMessage(chatId, chunk, {
          reply_to_message_id: i === 0 ? messageId : lastMessageId
        });
        lastMessageId = reply.message_id;
        // Only register the last message for conversational continuation
        if (i === chunks.length - 1) {
          global.temp.gemini[userId].push(
            { role: 'user', parts: [{ text: prompt }] },
            { role: 'model', parts: [{ text: responseText }] }
          );
          module.exports.onReplyRegister(bot, reply.message_id, userId);
        }
      }
    } catch (error) {
      console.error(error);
      await bot.sendMessage(chatId, module.exports.lang.error);
    }
  },

  /**
   * Registers a reply message for conversational tracking
   * Relaxed: No subscription checks or user data updates
   */

  onReplyRegister: (bot, messageId, userId) => {
    bot.on('message', async (msg) => {
      // Only process if the message is a reply to our registered message and from the same user
      if (msg.from.id !== userId || !msg.reply_to_message || msg.reply_to_message.message_id !== messageId) {
        return;
      }

      if (!(await checkChannelSubscription(bot, msg.from.id))) {
        return sendSubscriptionPrompt(bot, msg.chat.id);
      }

      // Trigger onReply for conversational flow
      if (module.exports.onReply) {
        await module.exports.onReply({
          bot,
          msg,
          args: msg.text?.trim().split(' ') || []
        });
      }
    });
  },


  processTextPrompt: async (msg, prompt) => {
    const chatModel = await genAI.getGenerativeModel(
      {
        model: 'gemini-2.5-flash-lite',
        systemInstruction,
        tools,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature
        },
      },
    );

    const chatBlock = global.temp.gemini[msg.from.id] || [];
    const chat = await chatModel.startChat({ history: chatBlock });
    const result = await chat.sendMessage(prompt);
    const responseText = (await result.response.text()).replace(/\*/g, '');

    if (!responseText) {
      global.temp.gemini[msg.from.id] = [];
      throw new Error('Context quota surpassed or empty response received.');
    }

    return responseText;
  },


  processImageReply: async (bot, msg, prompt) => {
    const photo = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1]; // Get highest quality photo
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const imagePart = await module.exports.urlToGenerativePart(fileUrl, file.file_path);

    const chatModel = await genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction,
      tools,
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      ],
    });

    const result = await chatModel.generateContent([prompt, imagePart]);
    return await result.response.text();
  },


  urlToGenerativePart: async (url, filePath) => {
    const MAX_SIZE = 20971520; // 20MB
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      throw new Error('The data size exceeds the maximum limit of 20 MB.');
    }

    const data = await response.buffer();
    if (data.length > MAX_SIZE) {
      throw new Error('The downloaded data exceeds the maximum limit of 20 MB.');
    }

    let mimeType = response.headers.get('content-type');

    const validImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!mimeType || mimeType === 'application/octet-stream') {

      const extension = path.extname(filePath).toLowerCase();
      const mimeTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      mimeType = mimeTypeMap[extension];
      if (!mimeType) {
        throw new Error('Unsupported image format');
      }
    } else if (!validImageMimeTypes.includes(mimeType)) {
      throw new Error('Unsupported image format');
    }

    return {
      inlineData: {
        data: data.toString('base64'),
        mimeType,
      },
    };
  }
};
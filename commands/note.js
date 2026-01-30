const fs = require('fs');
const path = require('path');

const NOTES_FILE = path.join(__dirname, '../store/notes.json');


function ensureNotesFile() {
  const dir = path.dirname(NOTES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify({}));
  }
}

function readNotes() {
  try {
    const data = fs.readFileSync(NOTES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading notes file:', error);
    return {};
  }
}

function writeNotes(notes) {
  try {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (error) {
    console.error('Error writing to notes file:', error);
    throw new Error('Failed to save note');
  }
}

function escapeMarkdownV2(text) {
  const reservedChars = /[_\*[\]()~`>#+\-=|{}.!\\]/g;
  return text.replace(reservedChars, '\\$&');
}

function getNotePreview(content) {
  const words = content.split(/\s+/).slice(0, 7);
  let preview = words.join(' ');
  if (words.length < content.split(/\s+/).length) {
    preview += '...';
  }
  return escapeMarkdownV2(preview);
}

module.exports = {
  name: 'note',
  version: 1.5,
  longDescription: 'Manage personal notes: add, list, view a note by ID, edit, or delete notes',
  shortDescription: 'Create and manage personal notes.',
  guide: '{pn} | add | list | delete | edit | <note ID> | <content>',
  category: ['Other Utilities', 6],
  lang: {
    usage: '📜 *Note Command Usage* 📜\n\n🔍 /note <note ID> - View a note\'s full content\n➕ /note add <content> - Add a new note\n📋 /note list - List all your notes\n🗑️ /note delete <note ID> - Delete a note\n✏️ /note edit <note ID> <new content> - Edit a note\n💬 Reply with /note to save a message',
    error: '❌ 𝗢𝗼𝗽𝘀! Something went wrong with your note command.',
    noNotes: '📝 𝗡𝗼 𝗡𝗼𝘁𝗲𝘀! Try /note add <content> or reply to a message to create one! ✨',
    invalidNoteId: '❌ 𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝗡𝗼𝘁𝗲 𝗜𝗗! Check /note list for valid IDs. 🔍',
    noteAdded: '✅ 𝗡𝗼𝘁𝗲 𝗔𝗱𝗱𝗲𝗱! Saved successfully! ✨',
    noteDeleted: '🗑️ 𝗡𝗼𝘁𝗲 𝗗𝗲𝗹𝗲𝘁𝗲𝗱!',
    noteEdited: '✏️ 𝗡𝗼𝘁𝗲 𝗨𝗽𝗱𝗮𝘁𝗲𝗱!',
    noContent: '❌ 𝗡𝗼 𝗖𝗼𝗻𝘁𝗲𝗻𝘁! Provide text or reply to a message. 📜',
    noteViewHeader: '🔍 𝗡𝗢𝗧𝗘 𝗩𝗜𝗘𝗪\n❖ 𝗡𝗼𝘁𝗲 𝗜𝗗: {id}',
    noteViewTemplate: '━━━━━━━━━━━━━━━━\n🕒 *𝗧𝗶𝗺𝗲*: {timestamp}\n📜 *𝗖𝗼𝗻𝘁𝗲𝗻𝘁*:\n{content}\n━━━━━━━━━━━━━━━━'
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    ensureNotesFile();
    const notes = readNotes();

    if (!notes[userId]) {
      notes[userId] = [];
    }

    try {
      // Handle /note (reply to a message)
      if (args.length === 0 && msg.reply_to_message?.text) {
        const noteContent = msg.reply_to_message.text;
        const note = {
          id: notes[userId].length + 1,
          content: noteContent,
          timestamp: new Date().toISOString()
        };
        notes[userId].push(note);
        writeNotes(notes);
        return bot.sendMessage(chatId, module.exports.lang.noteAdded);
      }

      // Handle /note <note ID>
      if (args.length === 1 && !isNaN(args[0])) {
        const noteId = parseInt(args[0], 10);
        const note = notes[userId].find(note => note.id === noteId);
        if (!note) {
          return bot.sendMessage(chatId, module.exports.lang.invalidNoteId);
        }
        const formattedTimestamp = escapeMarkdownV2(new Date(note.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }));
        const formattedContent = escapeMarkdownV2(note.content);
        const header = module.exports.lang.noteViewHeader.replace('{id}', noteId);
        const message = module.exports.lang.noteViewTemplate
          .replace('{timestamp}', formattedTimestamp)
          .replace('{content}', formattedContent);
        return bot.sendMessage(chatId, `${header}\n${message}`, { parse_mode: 'MarkdownV2' });
      }

      // Handle /note add <content>
      if (args[0]?.toLowerCase() === 'add') {
        const noteContent = msg.text.slice(msg.text.indexOf('add') + 4).trim();
        if (!noteContent) {
          return bot.sendMessage(chatId, module.exports.lang.noContent);
        }
        const note = {
          id: notes[userId].length + 1,
          content: noteContent,
          timestamp: new Date().toISOString()
        };
        notes[userId].push(note);
        writeNotes(notes);
        return bot.sendMessage(chatId, module.exports.lang.noteAdded);
      }

      // Handle /note list
      if (args[0]?.toLowerCase() === 'list') {
        if (notes[userId].length === 0) {
          return bot.sendMessage(chatId, module.exports.lang.noNotes);
        }
        const noteList = notes[userId].map(note => {
          return `❏ *𝗡𝗼𝘁𝗲 𝗜𝗗: ${note.id}*\n❖ *𝗣𝗿𝗲𝘃𝗶𝗲𝘄*: ${getNotePreview(note.content)}`;
        }).join('\n━━━━━━━━\n');
        const header = '✨ 📝 *𝗬𝗢𝗨𝗥 𝗡𝗢𝗧𝗘𝗦* 📝 ✨\n\n';
        return bot.sendMessage(chatId, header + noteList, { parse_mode: 'MarkdownV2' });
      }

      // Handle /note delete <note ID>
      if (args[0]?.toLowerCase() === 'delete' && args[1]) {
        const noteId = parseInt(args[1], 10);
        const noteIndex = notes[userId].findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
          return bot.sendMessage(chatId, module.exports.lang.invalidNoteId);
        }
        notes[userId].splice(noteIndex, 1);
        // Reassign IDs to maintain sequential order
        notes[userId].forEach((note, index) => { note.id = index + 1; });
        writeNotes(notes);
        return bot.sendMessage(chatId, module.exports.lang.noteDeleted);
      }

      // Handle /note edit <note ID> <new content>
      if (args[0]?.toLowerCase() === 'edit' && args[1]) {
        const noteId = parseInt(args[1], 10);
        const newContent = msg.text.slice(msg.text.indexOf(args[1]) + args[1].length).trim();
        if (!newContent) {
          return bot.sendMessage(chatId, module.exports.lang.noContent);
        }
        const note = notes[userId].find(note => note.id === noteId);
        if (!note) {
          return bot.sendMessage(chatId, module.exports.lang.invalidNoteId);
        }
        note.content = newContent;
        note.timestamp = new Date().toISOString();
        writeNotes(notes);
        return bot.sendMessage(chatId, module.exports.lang.noteEdited);
      }

      // Invalid command usage
      return bot.sendMessage(chatId, module.exports.lang.usage, {parse_mode: 'Markdown'});
    } catch (error) {
      console.error('Error in note command:', error);
      return bot.sendMessage(chatId, module.exports.lang.error);
    }
  },
};
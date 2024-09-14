const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const nhentaiSchema = new Schema(
  {
    doujinId: { type: String, required: true }, 
    mediaId: { type: String, required: true },
    title: {
      english: { type: String, required: false },
      japanese: { type: String, required: false },
      pretty: { type: String, required: false }
    },
    tags: { type: [String], required: true },
    pages: { type: Number, required: true },
    thumbnail: { type: String, required: true },
    previews: {
      telegraph_urls: { type: [String], required: true }
    },
    parodies: { type: String, required: false },
    characters: { type: String, required: false },
    artists: { type: String, required: false },
    groups: { type: String, required: false },
    languages: { type: String, required: false },
    categories: { type: String, required: false },
  },
  { timestamps: true }
);

module.exports = model('Nhentai', nhentaiSchema);

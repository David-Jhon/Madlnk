// DB/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    // required: true,
  },
  isBot: {
    type: Boolean,
    required: true,
  },
  username: {
    type: String,
    // required: true,
    sparse: true,
  },
  anilistUsername: {
    type: String,
    default: null,
    sparse: true,
  },
  anilistId: {
    type: Number,
    default: null,
    sparse: true,
  },
  isSubscribed: {
    type: Boolean,
    default: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  joined: {
    type: Date,
    default: Date.now
  }
});

/*
// Ensure indexing for faster lookups
userSchema.index({ userId: 1 });
userSchema.index({ username: 1 });
userSchema.index({ anilistUsername: 1 });
*/
module.exports = mongoose.model('User', userSchema);
const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
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
    required: true,
  },
  isBot: {
    type: Boolean,
    required: true,
  },
  username: {
    type: String, 
    required: true,
    unique: true,
  },
  anilistUsername: {
    type: String,
    unique: true,
  },
});

module.exports = mongoose.model('User', userSchema);
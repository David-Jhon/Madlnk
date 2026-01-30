const mongoose = require('mongoose');

const cronJobSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  schedule: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['command', 'script'],
    required: true,
  },
  action: {
    type: Object,
    required: true,
  },
  broadcast: {
    enabled: {
      type: Boolean,
      default: false,
    },
    target: {
      type: String,
      enum: ['owner', 'all'],
      default: 'owner',
    }
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastRun: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['idle', 'running', 'success', 'error'],
    default: 'idle',
  }
});

module.exports = mongoose.model('CronJob', cronJobSchema);

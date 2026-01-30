const mongoose = require('mongoose');

const commandLogSchema = new mongoose.Schema({
    commandName: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model('CommandLog', commandLogSchema);

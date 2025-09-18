// models/log.js
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
    {
        event:
            { type: String, required: true, trim: true },
        at:
            { type: Date,   required: true, default: Date.now },
        userId:
            { type: Number },  // רשות
        meta:
            { type: Object },  // רשות
    },
    {
        collection: 'logs',
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.models.Log || mongoose.model('Log', logSchema, 'logs');

// models/cost.js
const mongoose = require('mongoose');

const categories = require('./categories');

const isInt = {
    validator: Number.isInteger,
    message: '{VALUE} is not an integer',
};

const costSchema = new mongoose.Schema(
    {
        description:
            { type: String, required: true, trim: true },
        category:
            { type: String, required: true, enum: categories },
        userid:
            { type: Number, required: true, validate: isInt },
        sum:
            { type: Number, required: true, min: 0 },
    },
    {
        collection: 'costs',
        timestamps: true,
        versionKey: false,
    }
);

// אינדקס שימושי לשאילתות לפי משתמש/קטגוריה
costSchema.index({ userid: 1, category: 1 });

module.exports = mongoose.models.Cost || mongoose.model('Cost', costSchema, 'costs');

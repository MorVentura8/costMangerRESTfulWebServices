// models/reports.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// פריטי דו"ח בודדים (sum/description/day) – ללא _id פנימי
const itemSchema = new Schema(
    {
        sum: { type: Number, required: true, min: 0 },        // סכום (Double)
        description: { type: String, required: true, trim: true },
        day: { type: Number, required: true, min: 1, max: 31 } // היום בחודש
    },
    { _id: false }
);

/**
 * לשדה costs בחרתי מבנה גמיש כדי להתאים בקלות לפורמט ההחזרה:
 * בדו"ח המוחזר יש מערך של אובייקטים, כשכל אובייקט הוא קטגוריה עם מערך items.
 * לדוגמה:
 * [
 *   { food: [ {sum, description, day}, ... ] },
 *   { education: [ ... ] },
 *   { health: [] }, { housing: [] }, { sports: [] }
 * ]
 *
 * נשמור זאת כ-Array של Mixed (פשוט ועמיד), וכל אייטם בפנים יהיה:
 * { <categoryName>: [ itemSchema, ... ] }
 */
const reportSchema = new Schema(
    {
        userid: { type: Number, required: true },             // מספר שלם לוגית
        year:   { type: Number, required: true },             // שנת הדו"ח
        month:  { type: Number, required: true, min: 1, max: 12 }, // חודש (1-12)

        // מערך של אובייקטים {categoryName: [itemSchema[]]}
        costs: {
            type: [Schema.Types.Mixed],
            default: []
        }
    },
    { collection: 'reports', timestamps: true }
);

// אינדקס ייחודי כדי שלא יהיו שני דו"חות לאותו משתמש/חודש/שנה
reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Reports', reportSchema);

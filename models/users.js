// models/user.js
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const isInt = {
    validator: Number.isInteger,
    message: '{VALUE} is not an integer',
};

const userSchema = new Schema(
    {
        id:
            { type: Number, required: true, unique: true, validate: isInt },
        first_name:
            { type: String, required: true, trim: true },
        last_name:
            { type: String, required: true, trim: true },
        birthday:
            { type: Date,   required: true },
    },
    {
        collection: 'users',
        timestamps: true,   // אם לא תרצה createdAt/updatedAt—שנה ל-false
        versionKey: false,
    }
);

// מונע OverwriteModelError בזמן פיתוח (nodemon וכד')
module.exports = mongoose.models.User || mongoose.model('User', userSchema, 'users');

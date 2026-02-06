const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['Director', 'Sales Manager', 'Sales Executive', 'Delivery Team', 'Finance'],
        required: true
    },
    creatorCode: { type: String, enum: ['B1', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'D1', 'F1'], required: true },
    reportingManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    targets: [{
        year: { type: Number, required: true },
        period: { type: String, enum: ['Yearly', 'Half-Yearly', 'Quarterly'], required: true },
        amount: { type: Number, required: true }
    }],
    achievedTargets: [{
        year: Number,
        period: String,
        notifiedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);


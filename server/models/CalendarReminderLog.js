const mongoose = require('mongoose');

const CalendarReminderLogSchema = new mongoose.Schema({
    eventId: { type: String, required: true },
    reminderMinutes: { type: Number, required: true },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledFor: { type: Date, required: true },
    deliveredAt: { type: Date, default: Date.now }
}, { timestamps: true });

CalendarReminderLogSchema.index(
    { eventId: 1, reminderMinutes: 1, recipientId: 1 },
    { unique: true }
);

module.exports = mongoose.models.CalendarReminderLog || mongoose.model('CalendarReminderLog', CalendarReminderLogSchema);

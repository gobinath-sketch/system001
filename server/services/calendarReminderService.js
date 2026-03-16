const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const CalendarReminderLog = require('../models/CalendarReminderLog');
const { fetchCalendarEvents } = require('../email-automation/services/graphService');

const REMINDER_MINUTES = [1440, 720, 360, 180, 120, 60, 30, 5];
const LOOKAHEAD_MINUTES = 24 * 60 + 10;
const POLL_INTERVAL_MS = 15 * 1000;
const EARLY_DELIVERY_TOLERANCE_MS = 20 * 1000;
const DELIVERY_GRACE_MS = Math.max(5 * 60 * 1000, POLL_INTERVAL_MS * 4);

let intervalRef = null;
let isRunning = false;

function getMailbox() {
    return String(process.env.OUTLOOK_MAILBOX || '').trim();
}

function formatLeadTime(minutes) {
    if (minutes >= 60) {
        const hours = minutes / 60;
        return hours === 24 ? '24 hours' : `${hours} hours`;
    }
    return minutes === 30 ? '30 minutes' : `${minutes} minutes`;
}

function formatEventTime(dateValue) {
    return new Date(dateValue).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

async function getReminderRecipients() {
    return User.find({}, '_id').lean();
}

async function createReminderNotificationsForEvent(event, recipients, now) {
    if (!event?.id || !event?.start) return;

    const eventStart = new Date(event.start);
    if (Number.isNaN(eventStart.getTime()) || eventStart <= now) return;

    for (const reminderMinutes of REMINDER_MINUTES) {
        const scheduledFor = new Date(eventStart.getTime() - reminderMinutes * 60 * 1000);
        const isTooEarly = now.getTime() + EARLY_DELIVERY_TOLERANCE_MS < scheduledFor.getTime();
        const isTooLate = now.getTime() - scheduledFor.getTime() > DELIVERY_GRACE_MS;
        if (isTooEarly || isTooLate) {
            continue;
        }

        const existingLogs = await CalendarReminderLog.find({
            eventId: event.id,
            reminderMinutes,
            recipientId: { $in: recipients.map((recipient) => recipient._id) }
        }, 'recipientId').lean();

        const existingRecipientIds = new Set(existingLogs.map((log) => String(log.recipientId)));
        const recipientsToNotify = recipients.filter((recipient) => !existingRecipientIds.has(String(recipient._id)));

        if (!recipientsToNotify.length) {
            continue;
        }

        await CalendarReminderLog.insertMany(recipientsToNotify.map((recipient) => ({
            eventId: event.id,
            reminderMinutes,
            recipientId: recipient._id,
            scheduledFor,
            deliveredAt: now
        })), { ordered: false });

        const pendingNotifications = recipientsToNotify.map((recipient) => ({
            recipientId: recipient._id,
            type: 'calendar_reminder',
            message: `Reminder: "${event.subject || 'Calendar event'}" starts in ${formatLeadTime(reminderMinutes)}.`,
            triggeredByName: 'Calendar Reminder',
            changes: {
                eventId: event.id,
                subject: event.subject || 'Calendar event',
                organizer: event.organizer || '',
                start: event.start,
                end: event.end,
                location: event.location || '',
                reminderMinutes,
                scheduledFor: scheduledFor.toISOString(),
                webLink: event.webLink || ''
            }
        }));

        await Notification.insertMany(pendingNotifications, { ordered: false });
    }
}

async function runCalendarReminderSweep() {
    if (isRunning) return;
    if (mongoose.connection.readyState !== 1) return;

    const mailbox = getMailbox();
    if (!mailbox) return;

    isRunning = true;
    try {
        const now = new Date();
        const fromDate = new Date(now.getTime() - EARLY_DELIVERY_TOLERANCE_MS);
        const toDate = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60 * 1000);
        const [events, recipients] = await Promise.all([
            fetchCalendarEvents({
                mailbox,
                top: 250,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            }),
            getReminderRecipients()
        ]);

        if (!recipients.length || !events.length) {
            return;
        }

        for (const event of events) {
            await createReminderNotificationsForEvent(event, recipients, now);
        }
    } catch (error) {
        console.error('Calendar reminder sweep failed:', error.message);
    } finally {
        isRunning = false;
    }
}

function startCalendarReminderService() {
    if (intervalRef) return;
    intervalRef = setInterval(runCalendarReminderSweep, POLL_INTERVAL_MS);
    setTimeout(runCalendarReminderSweep, 5 * 1000);
}

module.exports = {
    startCalendarReminderService,
    runCalendarReminderSweep
};

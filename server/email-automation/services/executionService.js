const { upsertFromExtraction } = require('./mappingService');
const { createCalendarEvent } = require('./graphService');

function isMeaningfulString(value) {
    return String(value || '').trim().length > 0;
}

function normalizeAttendees(attendees = []) {
    if (!Array.isArray(attendees)) return [];
    return attendees
        .map((attendee) => {
            const email = String(attendee?.email || attendee?.address || '').trim();
            const name = String(attendee?.name || '').trim();
            if (!email) return null;
            return { email, name };
        })
        .filter(Boolean);
}

function shouldCreateCalendarEvent(extraction) {
    const meeting = extraction?.meeting || {};
    return Boolean(
        meeting?.shouldCreateEvent
        && isMeaningfulString(meeting?.subject)
        && isMeaningfulString(meeting?.start)
        && isMeaningfulString(meeting?.end)
    );
}

function shouldUpsertErpEntities(extraction) {
    const companyName = String(extraction?.client?.companyName || '').trim();
    const opportunity = extraction?.opportunity || {};
    return Boolean(
        companyName
        || String(opportunity?.opportunityNumber || '').trim()
        || String(opportunity?.type || '').trim()
        || String(opportunity?.requirementSummary || '').trim()
        || Number(opportunity?.participants || 0) > 0
        || Number(opportunity?.days || 0) > 0
    );
}

async function maybeCreateCalendarEvent(extraction, emailMeta) {
    if (!shouldCreateCalendarEvent(extraction)) {
        return null;
    }

    const mailbox = String(process.env.OUTLOOK_MAILBOX || '').trim();
    if (!mailbox) {
        throw new Error('OUTLOOK_MAILBOX is required for calendar event creation');
    }

    const meeting = extraction.meeting || {};
    const fallbackDescription = [
        emailMeta?.subject ? `Source email: ${emailMeta.subject}` : '',
        emailMeta?.fromName || emailMeta?.fromEmail ? `Requested by: ${emailMeta.fromName || emailMeta.fromEmail}` : '',
        meeting?.notes ? `Notes: ${meeting.notes}` : '',
        meeting?.meetingLink ? `Meeting link: ${meeting.meetingLink}` : ''
    ].filter(Boolean).join('\n');

    return createCalendarEvent({
        mailbox,
        event: {
            subject: meeting.subject,
            bodyText: meeting.description || fallbackDescription,
            start: meeting.start,
            end: meeting.end,
            timeZone: meeting.timeZone || process.env.GRAPH_TIMEZONE || 'Asia/Kolkata',
            location: meeting.location || '',
            attendees: normalizeAttendees(meeting.attendees),
            isAllDay: Boolean(meeting.isAllDay)
        }
    });
}

async function executeExtraction({ extraction, emailMeta, actorId = null }) {
    const entityResult = shouldUpsertErpEntities(extraction)
        ? await upsertFromExtraction({ extraction, emailMeta, actorId })
        : { actorId: null, clientId: null, opportunityId: null };
    const calendarEvent = await maybeCreateCalendarEvent(extraction, emailMeta);

    return {
        ...entityResult,
        calendarEventId: calendarEvent?.id || null,
        calendarEventWebLink: calendarEvent?.webLink || '',
        calendarEventSubject: calendarEvent?.subject || ''
    };
}

module.exports = {
    executeExtraction,
    shouldCreateCalendarEvent
};

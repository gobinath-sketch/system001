const { httpJson } = require('./httpClient');

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function requiredEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Missing required env: ${name}`);
    return value;
}

async function getGraphAccessToken() {
    const tenantId = requiredEnv('AZURE_TENANT_ID');
    const clientId = requiredEnv('AZURE_CLIENT_ID');
    const clientSecret = requiredEnv('AZURE_CLIENT_SECRET');

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default'
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
        const err = new Error('Failed to get Microsoft Graph access token');
        err.payload = payload;
        throw err;
    }

    return payload.access_token;
}

function stripHtml(html = '') {
    return String(html)
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function toGraphDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    // Keep local date-time strings local so Graph can apply the provided timeZone correctly.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
        return raw.length === 16 ? `${raw}:00` : raw;
    }
    return new Date(raw).toISOString();
}

function normalizeGraphMessage(message, mailbox, options = {}) {
    const bodyContent = message?.body?.content || '';
    const fromAddress = message?.from?.emailAddress || {};
    const includeBodyHtml = Boolean(options.includeBodyHtml);
    const plain = stripHtml(bodyContent);
    return {
        mailbox,
        graphMessageId: message?.id || '',
        internetMessageId: message?.internetMessageId || '',
        conversationId: message?.conversationId || '',
        subject: message?.subject || '',
        bodyText: plain.slice(0, 20000),
        bodyPreview: plain.slice(0, 280),
        bodyHtml: includeBodyHtml ? String(bodyContent || '') : '',
        fromEmail: fromAddress.address || '',
        fromName: fromAddress.name || '',
        to: (message?.toRecipients || []).map((x) => x?.emailAddress?.address).filter(Boolean),
        cc: (message?.ccRecipients || []).map((x) => x?.emailAddress?.address).filter(Boolean),
        receivedAt: message?.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
        isRead: Boolean(message?.isRead),
        webLink: message?.webLink || '',
        rawPayload: message
    };
}

function normalizeFolder(folder) {
    const value = String(folder || 'inbox').trim().toLowerCase();
    const map = {
        all: 'all',
        inbox: 'inbox',
        sentitems: 'sentitems',
        sent: 'sentitems',
        drafts: 'drafts',
        deleteditems: 'deleteditems',
        deleted: 'deleteditems',
        junkemail: 'junkemail',
        junk: 'junkemail',
        archive: 'archive',
        notes: 'notes'
    };
    return map[value] || 'inbox';
}

function buildFolderMessagesUrl({ mailbox, folder = 'inbox', top = 50, fromDate, toDate }) {
    const cappedTop = Math.max(1, Math.min(Number(top) || 50, 500));
    const select = [
        'id',
        'internetMessageId',
        'conversationId',
        'subject',
        'body',
        'webLink',
        'from',
        'toRecipients',
        'ccRecipients',
        'receivedDateTime',
        'isRead'
    ].join(',');

    const params = [
        `$top=${cappedTop}`,
        `$orderby=receivedDateTime desc`,
        `$select=${encodeURIComponent(select)}`
    ];

    const filters = [];
    if (fromDate) filters.push(`receivedDateTime ge ${new Date(fromDate).toISOString()}`);
    if (toDate) filters.push(`receivedDateTime le ${new Date(toDate).toISOString()}`);
    if (filters.length) params.push(`$filter=${encodeURIComponent(filters.join(' and '))}`);

    const folderId = normalizeFolder(folder);
    if (folderId === 'all') {
        return `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/messages?${params.join('&')}`;
    }
    return `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/mailFolders/${folderId}/messages?${params.join('&')}`;
}

async function fetchFolderMessagesPage({ mailbox, folder = 'inbox', top = 50, fromDate, toDate, pageUrl }) {
    if (!mailbox) throw new Error('mailbox is required');
    const token = await getGraphAccessToken();
    const url = pageUrl || buildFolderMessagesUrl({ mailbox, folder, top, fromDate, toDate });

    const payload = await httpJson(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    return {
        messages: (payload.value || []).map((m) => normalizeGraphMessage(m, mailbox, { includeBodyHtml: false })),
        nextLink: payload['@odata.nextLink'] || null
    };
}

async function fetchInboxMessages({ mailbox, top = 50, fromDate, toDate, pageUrl, all = false, maxPages = 20 }) {
    return fetchFolderMessages({ mailbox, folder: 'inbox', top, fromDate, toDate, pageUrl, all, maxPages });
}

async function fetchFolderMessages({ mailbox, folder = 'inbox', top = 50, fromDate, toDate, pageUrl, all = false, maxPages = 20 }) {
    if (!all) {
        return fetchFolderMessagesPage({ mailbox, folder, top, fromDate, toDate, pageUrl });
    }

    const allMessages = [];
    let next = pageUrl || null;
    let first = true;
    let pages = 0;

    while (pages < maxPages) {
        const page = await fetchFolderMessagesPage({
            mailbox,
            folder,
            top,
            fromDate,
            toDate,
            pageUrl: first ? pageUrl : next
        });
        allMessages.push(...page.messages);
        next = page.nextLink;
        pages += 1;
        first = false;
        if (!next) break;
    }

    return {
        messages: allMessages,
        nextLink: next
    };
}

async function fetchRecentInboxMessages({ mailbox, top = 25 }) {
    const result = await fetchFolderMessages({ mailbox, folder: 'inbox', top });
    return result.messages;
}

async function fetchMessageById({ mailbox, messageId }) {
    if (!mailbox || !messageId) throw new Error('mailbox and messageId are required');
    const token = await getGraphAccessToken();
    const select = [
        'id',
        'internetMessageId',
        'conversationId',
        'subject',
        'body',
        'webLink',
        'from',
        'toRecipients',
        'ccRecipients',
        'receivedDateTime',
        'isRead'
    ].join(',');
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}?$select=${encodeURIComponent(select)}`;
    const payload = await httpJson(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return normalizeGraphMessage(payload, mailbox, { includeBodyHtml: true });
}

async function fetchCalendarEvents({ mailbox, top = 100, fromDate, toDate }) {
    if (!mailbox) throw new Error('mailbox is required');
    const token = await getGraphAccessToken();
    const cappedTop = Math.max(1, Math.min(Number(top) || 100, 500));
    const select = ['id', 'subject', 'start', 'end', 'organizer', 'location', 'isAllDay', 'webLink'].join(',');

    // Use calendarView for reliable date-range retrieval
    const rangeStart = fromDate ? new Date(fromDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const rangeEnd = toDate ? new Date(toDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const params = [
        `startDateTime=${encodeURIComponent(rangeStart.toISOString())}`,
        `endDateTime=${encodeURIComponent(rangeEnd.toISOString())}`,
        `$top=${cappedTop}`,
        `$orderby=start/dateTime desc`,
        `$select=${encodeURIComponent(select)}`
    ];

    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/calendarView?${params.join('&')}`;
    const timezone = String(process.env.GRAPH_TIMEZONE || 'Asia/Kolkata').trim();
    const payload = await httpJson(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Prefer: `outlook.timezone="${timezone}"`
        }
    });

    return (payload.value || []).map((e) => ({
        id: e.id,
        subject: e.subject || '(No Subject)',
        start: e.start?.dateTime || null,
        end: e.end?.dateTime || null,
        organizer: e.organizer?.emailAddress?.address || '',
        location: e.location?.displayName || '',
        isAllDay: Boolean(e.isAllDay),
        webLink: e.webLink || ''
    }));
}

async function fetchCalendarEventById({ mailbox, eventId }) {
    if (!mailbox || !eventId) throw new Error('mailbox and eventId are required');
    const token = await getGraphAccessToken();
    const select = [
        'id',
        'subject',
        'body',
        'start',
        'end',
        'organizer',
        'location',
        'isAllDay',
        'webLink'
    ].join(',');
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/events/${encodeURIComponent(eventId)}?$select=${encodeURIComponent(select)}`;
    const timezone = String(process.env.GRAPH_TIMEZONE || 'Asia/Kolkata').trim();
    const payload = await httpJson(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Prefer: `outlook.timezone="${timezone}"`
        }
    });
    return {
        id: payload.id,
        subject: payload.subject || '(No Subject)',
        start: payload.start?.dateTime || null,
        end: payload.end?.dateTime || null,
        organizer: payload.organizer?.emailAddress?.address || '',
        location: payload.location?.displayName || '',
        isAllDay: Boolean(payload.isAllDay),
        webLink: payload.webLink || '',
        bodyHtml: payload.body?.content || '',
        bodyText: stripHtml(payload.body?.content || '').slice(0, 20000)
    };
}

async function createCalendarEvent({ mailbox, event }) {
    if (!mailbox) throw new Error('mailbox is required');
    if (!event?.subject || !event?.start || !event?.end) {
        throw new Error('event subject, start, and end are required');
    }

    const token = await getGraphAccessToken();
    const timezone = String(event.timeZone || process.env.GRAPH_TIMEZONE || 'Asia/Kolkata').trim();
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/events`;

    const payload = {
        subject: String(event.subject).trim(),
        start: {
            dateTime: toGraphDateTime(event.start),
            timeZone: timezone
        },
        end: {
            dateTime: toGraphDateTime(event.end),
            timeZone: timezone
        },
        isAllDay: Boolean(event.isAllDay),
        body: {
            contentType: 'text',
            content: String(event.bodyText || '').slice(0, 5000)
        }
    };

    if (String(event.location || '').trim()) {
        payload.location = { displayName: String(event.location).trim() };
    }

    if (Array.isArray(event.attendees) && event.attendees.length) {
        payload.attendees = event.attendees
            .filter((attendee) => attendee?.email)
            .map((attendee) => ({
                emailAddress: {
                    address: attendee.email,
                    name: attendee.name || attendee.email
                },
                type: 'required'
            }));
    }

    const created = await httpJson(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: `outlook.timezone="${timezone}"`
        },
        body: JSON.stringify(payload)
    });

    return {
        id: created.id,
        subject: created.subject || '(No Subject)',
        start: created.start?.dateTime || null,
        end: created.end?.dateTime || null,
        webLink: created.webLink || '',
        organizer: created.organizer?.emailAddress?.address || '',
        location: created.location?.displayName || ''
    };
}

async function fetchJoinedTeams({ mailbox, top = 50 }) {
    if (!mailbox) throw new Error('mailbox is required');
    const token = await getGraphAccessToken();
    // joinedTeams does not reliably support $top in some tenants; omit it for compatibility
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/joinedTeams`;
    const payload = await httpJson(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return (payload.value || []).map((t) => ({
        id: t.id,
        displayName: t.displayName || '',
        description: t.description || ''
    }));
}

async function fetchTeamChannels({ teamId, top = 100 }) {
    if (!teamId) throw new Error('teamId is required');
    const token = await getGraphAccessToken();
    // Some tenants reject $top for channels. Omit for compatibility.
    const url = `${GRAPH_BASE_URL}/teams/${encodeURIComponent(teamId)}/channels`;
    const payload = await httpJson(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return (payload.value || []).map((c) => ({
        id: c.id,
        displayName: c.displayName || '',
        description: c.description || ''
    }));
}

async function fetchChannelMessages({ teamId, channelId, top = 50 }) {
    if (!teamId || !channelId) throw new Error('teamId and channelId are required');
    const token = await getGraphAccessToken();
    const cappedTop = Math.max(1, Math.min(Number(top) || 50, 200));
    const url = `${GRAPH_BASE_URL}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages?$top=${cappedTop}`;
    const payload = await httpJson(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return (payload.value || []).map((m) => ({
        id: m.id,
        subject: m.subject || '',
        summary: stripHtml(m.body?.content || '').slice(0, 500),
        from: m.from?.user?.displayName || m.from?.application?.displayName || '',
        createdAt: m.createdDateTime || null,
        webUrl: m.webUrl || ''
    }));
}


async function sendMail({ to, subject, htmlBody, textBody }) {
    const mailbox = String(process.env.OUTLOOK_MAILBOX || '').trim();
    if (!mailbox) throw new Error('OUTLOOK_MAILBOX env var is not configured');

    const token = await getGraphAccessToken();
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/sendMail`;

    const payload = {
        message: {
            subject: String(subject || '').trim(),
            body: {
                contentType: htmlBody ? 'HTML' : 'Text',
                content: htmlBody || textBody || ''
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: to
                    }
                }
            ]
        },
        saveToSentItems: true
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok && response.status !== 202) {
        const text = await response.text();
        throw new Error(`sendMail failed (${response.status}): ${text}`);
    }
    return true;
}

module.exports = {
    getGraphAccessToken,
    fetchRecentInboxMessages,
    fetchInboxMessages,
    fetchFolderMessages,
    fetchMessageById,
    fetchCalendarEvents,
    fetchCalendarEventById,
    createCalendarEvent,
    fetchJoinedTeams,
    fetchTeamChannels,
    fetchChannelMessages,
    sendMail,
    // Notes (OneNote) intentionally removed for app-only limitations
};

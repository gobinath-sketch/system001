const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/authMiddleware');
const EmailIngestion = require('../models/EmailIngestion');
const {
    fetchFolderMessages,
    fetchMessageById,
    fetchCalendarEvents,
    fetchCalendarEventById,
    fetchJoinedTeams,
    fetchTeamChannels,
    fetchChannelMessages,
    getGraphAccessToken
} = require('../services/graphService');
const { buildAuthUrl, exchangeCodeForToken, upsertUserToken, getValidAccessToken } = require('../services/graphDelegatedAuth');
const { processNormalizedEmail, approveQueuedItem, rejectQueuedItem } = require('../services/processor');

function getMailbox() {
    return String(process.env.OUTLOOK_MAILBOX || '').trim();
}

function resolveDateRange(period, fromDate, toDate, anchorDate) {
    if (fromDate || toDate) {
        return { fromDate: fromDate || null, toDate: toDate || null };
    }

    const now = anchorDate ? new Date(anchorDate) : new Date();
    const p = String(period || '').toLowerCase();

    const startOfDay = (d) => {
        const t = new Date(d);
        t.setHours(0, 0, 0, 0);
        return t;
    };
    const endOfDay = (d) => {
        const t = new Date(d);
        t.setHours(23, 59, 59, 999);
        return t;
    };

    if (p === 'day') {
        const start = startOfDay(now);
        const end = endOfDay(now);
        return { fromDate: start.toISOString(), toDate: end.toISOString() };
    }

    if (p === 'week') {
        const start = startOfDay(now);
        const day = start.getDay(); // 0=Sun..6=Sat
        const diffToMonday = (day + 6) % 7; // Monday=0
        start.setDate(start.getDate() - diffToMonday);
        const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
        return { fromDate: start.toISOString(), toDate: end.toISOString() };
    }

    if (p === 'month') {
        const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        return { fromDate: start.toISOString(), toDate: end.toISOString() };
    }

    if (p === 'year') {
        const start = startOfDay(new Date(now.getFullYear(), 0, 1));
        const end = endOfDay(new Date(now.getFullYear(), 11, 31));
        return { fromDate: start.toISOString(), toDate: end.toISOString() };
    }

    if (p === 'all') {
        const start = startOfDay(new Date(now.getFullYear() - 2, 0, 1));
        const end = endOfDay(new Date(now.getFullYear() + 2, 11, 31));
        return { fromDate: start.toISOString(), toDate: end.toISOString() };
    }

    return { fromDate: null, toDate: null };
}

function normalizeDateInput(value, isEnd = false) {
    if (!value) return null;
    const v = String(value).trim();
    // If date-only, expand to full day
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return isEnd ? `${v}T23:59:59.999Z` : `${v}T00:00:00.000Z`;
    }
    return v;
}

router.get('/health', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Delivery Head', 'Delivery Executive', 'Finance', 'Super Admin'), async (req, res) => {
    const required = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'OUTLOOK_MAILBOX'];
    const missing = required.filter((k) => !String(process.env[k] || '').trim());
    const llmConfigured = Boolean(String(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim());

    res.json({
        ok: missing.length === 0,
        missing,
        llmConfigured,
        autoThreshold: Number(process.env.MAIL_AUTOMATION_AUTO_THRESHOLD || 0.9),
        mailbox: getMailbox()
    });
});

router.get('/queue', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    const status = String(req.query.status || 'needs_review');
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const items = await EmailIngestion.find({ status }).sort({ createdAt: -1 }).limit(limit).populate('linkedEntities.clientId', 'companyName').populate('linkedEntities.opportunityId', 'opportunityNumber');
    res.json(items);
});

router.get('/history', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 100), 300);
    const items = await EmailIngestion.find({ status: { $in: ['processed', 'ignored', 'failed'] } })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .populate('decision.reviewedBy', 'name role')
        .populate('linkedEntities.clientId', 'companyName')
        .populate('linkedEntities.opportunityId', 'opportunityNumber');
    res.json(items);
});

router.get('/mailbox/messages', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });

        const top = Math.min(Number(req.query.top || 100), 500);
        const all = String(req.query.all || 'false').toLowerCase() === 'true';
        const folder = String(req.query.folder || 'inbox');
        const pageUrl = req.query.pageUrl ? String(req.query.pageUrl) : null;
        const { fromDate, toDate } = resolveDateRange(req.query.period, req.query.fromDate, req.query.toDate);

        const result = await fetchFolderMessages({
            mailbox,
            folder,
            top,
            fromDate,
            toDate,
            pageUrl,
            all,
            maxPages: Math.min(Number(req.query.maxPages || 20), 60)
        });

        res.json({
            mailbox,
            folder,
            count: result.messages.length,
            nextLink: result.nextLink,
            messages: result.messages
        });
    } catch (error) {
        res.status(500).json({ message: error.message, detail: error?.payload || null });
    }
});

router.get('/mailbox/messages/:messageId', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });
        const message = await fetchMessageById({ mailbox, messageId: req.params.messageId });
        res.json(message);
    } catch (error) {
        res.status(500).json({ message: error.message, detail: error?.payload || null });
    }
});

router.get('/calendar/events', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });
        const top = Math.min(Number(req.query.top || 200), 500);
        const range = resolveDateRange(req.query.period, req.query.fromDate, req.query.toDate, req.query.anchorDate);
        const fromDate = normalizeDateInput(range.fromDate || req.query.fromDate, false);
        const toDate = normalizeDateInput(range.toDate || req.query.toDate, true);
        const events = await fetchCalendarEvents({ mailbox, top, fromDate, toDate });
        res.json({ mailbox, count: events.length, events });
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});

router.get('/calendar/events/:eventId', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });
        const event = await fetchCalendarEventById({ mailbox, eventId: req.params.eventId });
        res.json(event);
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});

router.get('/teams', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });
        const teams = await fetchJoinedTeams({ mailbox });
        res.json({ mailbox, count: teams.length, teams });
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});

router.get('/teams/:teamId/channels', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const channels = await fetchTeamChannels({ teamId: req.params.teamId });
        res.json({ count: channels.length, channels });
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});

router.get('/teams/:teamId/channels/:channelId/messages', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const messages = await fetchChannelMessages({
            teamId: req.params.teamId,
            channelId: req.params.channelId,
            top: Number(req.query.top || 200)
        });
        res.json({ count: messages.length, messages });
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});


router.post('/queue/:id/review', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const { action, notes = '', draftExtraction = null } = req.body || {};
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'action must be approve or reject' });
        }

        const result = action === 'approve'
            ? await approveQueuedItem({ ingestionId: req.params.id, reviewerId: req.user._id, notes, draftExtraction })
            : await rejectQueuedItem({ ingestionId: req.params.id, reviewerId: req.user._id, notes });

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/ingest/pull', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });

        const top = Math.min(Number(req.body?.top || 100), 500);
        const forceReview = Boolean(req.body?.forceReview);
        const folder = String(req.body?.folder || 'inbox');
        const all = Boolean(req.body?.all);
        const { fromDate, toDate } = resolveDateRange(req.body?.period, req.body?.fromDate, req.body?.toDate);

        const fetched = await fetchFolderMessages({
            mailbox,
            folder,
            top,
            fromDate,
            toDate,
            all,
            maxPages: Math.min(Number(req.body?.maxPages || 20), 60)
        });
        const messages = fetched.messages || [];

        const results = [];
        for (const msg of messages) {
            const processed = await processNormalizedEmail(msg, { forceReview });
            results.push({
                id: processed._id,
                status: processed.status,
                confidence: processed.confidence,
                subject: processed.subject
            });
        }

        res.json({
            mailbox,
            folder,
            pulled: messages.length,
            nextLink: fetched?.nextLink || null,
            results
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
            detail: error?.payload || null
        });
    }
});

router.post('/ingest/selected', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const mailbox = getMailbox();
        if (!mailbox) return res.status(400).json({ message: 'Set OUTLOOK_MAILBOX env first' });

        const messageIds = Array.isArray(req.body?.messageIds)
            ? req.body.messageIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [];

        if (!messageIds.length) {
            return res.status(400).json({ message: 'messageIds is required' });
        }

        const uniqueMessageIds = [...new Set(messageIds)].slice(0, 100);
        const forceReview = Boolean(req.body?.forceReview);
        const results = [];

        for (const messageId of uniqueMessageIds) {
            const normalized = await fetchMessageById({ mailbox, messageId });
            const processed = await processNormalizedEmail(normalized, { forceReview });
            results.push({
                messageId,
                id: processed._id,
                status: processed.status,
                confidence: processed.confidence,
                subject: processed.subject
            });
        }

        res.json({
            mailbox,
            processed: results.length,
            results
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
            detail: error?.payload || null
        });
    }
});

router.post('/ingest/message', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const body = req.body || {};
        const normalized = {
            mailbox: body.mailbox || getMailbox(),
            graphMessageId: body.graphMessageId || '',
            internetMessageId: body.internetMessageId || '',
            conversationId: body.conversationId || '',
            fromEmail: body.fromEmail || '',
            fromName: body.fromName || '',
            to: body.to || [],
            cc: body.cc || [],
            subject: body.subject || '',
            bodyText: body.bodyText || '',
            receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
            rawPayload: body
        };
        const result = await processNormalizedEmail(normalized, {
            forceReview: Boolean(body.forceReview),
            sourceContext: body.sourceContext || {}
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Unified source ingestion: email + teams + attachments/notes context
router.post('/ingest/unified', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const body = req.body || {};
        const message = body.message || {};
        const normalized = {
            mailbox: message.mailbox || getMailbox(),
            graphMessageId: message.graphMessageId || '',
            internetMessageId: message.internetMessageId || '',
            conversationId: message.conversationId || '',
            fromEmail: message.fromEmail || '',
            fromName: message.fromName || '',
            to: message.to || [],
            cc: message.cc || [],
            subject: message.subject || '',
            bodyText: message.bodyText || '',
            receivedAt: message.receivedAt ? new Date(message.receivedAt) : new Date(),
            rawPayload: body
        };

        const sourceContext = {
            teamsMessages: body.teamsMessages || [],
            attachmentsText: body.attachmentsText || [],
            notes: body.notes || []
        };

        const result = await processNormalizedEmail(normalized, {
            forceReview: Boolean(body.forceReview),
            sourceContext
        });

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/webhook', async (req, res) => {
    if (req.query.validationToken) {
        return res.status(200).send(req.query.validationToken);
    }

    try {
        const notifications = req.body?.value || [];
        const mailbox = getMailbox();
        if (!mailbox) return res.status(202).json({ accepted: true, skipped: 'OUTLOOK_MAILBOX missing' });

        for (const n of notifications) {
            const idFromResourceData = n?.resourceData?.id;
            if (!idFromResourceData) continue;
            const message = await fetchMessageById({ mailbox, messageId: idFromResourceData });
            await processNormalizedEmail(message);
        }

        return res.status(202).json({ accepted: true, count: notifications.length });
    } catch (error) {
        return res.status(202).json({ accepted: true, error: error.message });
    }
});

router.get('/graph/token-check', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        await getGraphAccessToken();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message, detail: error.payload || null });
    }
});

// Delegated auth for Teams chats
const chatAuthState = new Map();

router.get('/chats/auth/url', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const state = `${req.user._id}:${Date.now()}`;
        chatAuthState.set(state, req.user._id.toString());
        const url = buildAuthUrl(state);
        res.json({ url });
    } catch (error) {
        res.status(500).json({ message: error.message, detail: error?.payload || null });
    }
});

router.get('/chats/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query || {};
        if (!code || !state) return res.status(400).send('Missing code/state');
        const userId = chatAuthState.get(state);
        if (!userId) return res.status(400).send('Invalid state');
        chatAuthState.delete(state);

        const tokenPayload = await exchangeCodeForToken(code);
        await upsertUserToken(userId, tokenPayload);

        const redirect = String(process.env.GRAPH_AUTH_SUCCESS_REDIRECT || '').trim();
        if (redirect) return res.redirect(redirect);
        return res.send('Teams chat connected. You can close this tab.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

router.get('/chats', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const token = await getValidAccessToken(req.user._id);
        const top = Math.min(Number(req.query.top || 50), 200);
        const url = `https://graph.microsoft.com/v1.0/me/chats?$top=${top}`;
        const payload = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(async r => {
            const data = await r.json();
            if (!r.ok) {
                const err = new Error('Failed to fetch chats');
                err.payload = data;
                throw err;
            }
            return data;
        });

        const chats = (payload.value || []).map(c => ({
            id: c.id,
            topic: c.topic || '',
            chatType: c.chatType || '',
            lastUpdatedDateTime: c.lastUpdatedDateTime || null
        }));

        res.json({ count: chats.length, chats });
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});

router.get('/chats/:chatId/messages', protect, authorize('Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Finance', 'Super Admin'), async (req, res) => {
    try {
        const token = await getValidAccessToken(req.user._id);
        const top = Math.min(Number(req.query.top || 50), 200);
        const url = `https://graph.microsoft.com/v1.0/me/chats/${encodeURIComponent(req.params.chatId)}/messages?$top=${top}`;
        const payload = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(async r => {
            const data = await r.json();
            if (!r.ok) {
                const err = new Error('Failed to fetch chat messages');
                err.payload = data;
                throw err;
            }
            return data;
        });

        const messages = (payload.value || []).map(m => ({
            id: m.id,
            from: m.from?.user?.displayName || m.from?.application?.displayName || '',
            createdAt: m.createdDateTime || null,
            body: m.body?.content ? m.body.content.replace(/<[^>]+>/g, '').slice(0, 1000) : ''
        }));

        res.json({ count: messages.length, messages });
    } catch (error) {
        const graphMessage = error?.payload?.error?.message;
        res.status(500).json({ message: graphMessage || error.message, detail: error?.payload || null });
    }
});

module.exports = router;

const Client = require('../../models/Client');
const Opportunity = require('../../models/Opportunity');
const EmailIngestion = require('../models/EmailIngestion');

function empty(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
}

function fillShallow(target, fallback) {
    const out = { ...(target || {}) };
    for (const [k, v] of Object.entries(fallback || {})) {
        if (empty(out[k]) && !empty(v)) out[k] = v;
    }
    return out;
}

function mergeSourceTexts(sourceContext = {}) {
    const chunks = [];
    const teams = sourceContext.teamsMessages || [];
    const notes = sourceContext.notes || [];
    const attachments = sourceContext.attachmentsText || [];

    for (const t of teams) chunks.push(`[Teams] ${String(t.text || '').trim()}`);
    for (const n of notes) chunks.push(`[Note] ${String(n).trim()}`);
    for (const a of attachments) chunks.push(`[AttachmentText] ${String(a).trim()}`);

    return chunks.filter(Boolean).join('\n').slice(0, 30000);
}

async function getEntityContext(extraction, message) {
    const companyName = String(extraction?.client?.companyName || '').trim();
    const oppNumber = String(extraction?.opportunity?.opportunityNumber || '').trim();
    const fromDomain = String(message?.fromEmail || '').split('@')[1] || '';

    let client = null;
    let opportunity = null;

    if (companyName) {
        client = await Client.findOne({
            companyName: { $regex: new RegExp(`^${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            isDeleted: { $ne: true }
        }).lean();
    }

    if (!client && fromDomain) {
        const possibleClients = await Client.find({ isDeleted: { $ne: true } }).lean();
        client = possibleClients.find((c) => String(c.companyName || '').toLowerCase().includes(fromDomain.split('.')[0])) || null;
    }

    if (oppNumber) {
        opportunity = await Opportunity.findOne({ opportunityNumber: oppNumber, isDeleted: { $ne: true } }).lean();
    } else if (client?._id) {
        opportunity = await Opportunity.findOne({ client: client._id, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean();
    }

    return { client, opportunity };
}

async function getConversationContext(message) {
    if (!message?.conversationId) return null;
    const recent = await EmailIngestion.find({ conversationId: message.conversationId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    if (!recent.length) return null;
    return recent;
}

async function enrichExtraction({ extraction, message, sourceContext }) {
    const out = JSON.parse(JSON.stringify(extraction || {}));
    const sourceText = mergeSourceTexts(sourceContext || {});
    if (sourceText) {
        out.opportunity = out.opportunity || {};
        if (!out.opportunity.requirementSummary) {
            out.opportunity.requirementSummary = sourceText.slice(0, 3000);
        }
    }

    const { client, opportunity } = await getEntityContext(out, message);
    const conversation = await getConversationContext(message);

    if (client) {
        out.client = fillShallow(out.client, {
            companyName: client.companyName,
            sector: client.sector,
            contactPersons: client.contactPersons || []
        });
    }

    if (opportunity) {
        out.opportunity = fillShallow(out.opportunity, {
            opportunityNumber: opportunity.opportunityNumber,
            type: opportunity.type,
            participants: opportunity.participants,
            days: opportunity.days,
            requirementSummary: opportunity.requirementSummary,
            typeSpecificDetails: opportunity.typeSpecificDetails || {},
            commonDetails: opportunity.commonDetails || {},
            poValue: opportunity.poValue || 0,
            invoiceValue: opportunity.invoiceValue || 0
        });
    }

    if (conversation && conversation.length > 0) {
        const latest = conversation[0];
        out.client = fillShallow(out.client, latest?.extraction?.client || {});
        out.opportunity = fillShallow(out.opportunity, latest?.extraction?.opportunity || {});
        if (empty(out.intent) || out.intent === 'ignore') {
            out.intent = latest?.classification?.intent || out.intent;
        }
    }

    out.meta = {
        ...(out.meta || {}),
        sourceContextUsed: Boolean(sourceText),
        entityContextUsed: Boolean(client || opportunity),
        conversationContextUsed: Boolean(conversation && conversation.length > 0)
    };

    return out;
}

module.exports = {
    enrichExtraction
};


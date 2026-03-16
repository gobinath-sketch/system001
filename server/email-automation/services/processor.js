const EmailIngestion = require('../models/EmailIngestion');
const { extractFromEmail } = require('./extractionService');
const { upsertFromExtraction } = require('./mappingService');
const { enrichExtraction } = require('./contextEnrichmentService');

function autoThreshold() {
    const value = Number(process.env.MAIL_AUTOMATION_AUTO_THRESHOLD || 0.9);
    if (!Number.isFinite(value)) return 0.9;
    return Math.max(0, Math.min(1, value));
}

function appendLog(doc, message) {
    doc.processingLog = doc.processingLog || [];
    doc.processingLog.push({ message });
}

async function processNormalizedEmail(message, options = {}) {
    const existing = await EmailIngestion.findOne({
        $or: [
            { internetMessageId: message.internetMessageId || null },
            { graphMessageId: message.graphMessageId || null }
        ]
    });
    if (existing) return existing;

    const ingestion = new EmailIngestion({
        mailbox: message.mailbox || '',
        internetMessageId: message.internetMessageId || '',
        graphMessageId: message.graphMessageId || '',
        conversationId: message.conversationId || '',
        fromEmail: message.fromEmail || '',
        fromName: message.fromName || '',
        to: message.to || [],
        cc: message.cc || [],
        subject: message.subject || '',
        bodyText: message.bodyText || '',
        receivedAt: message.receivedAt || new Date(),
        rawPayload: message.rawPayload || message,
        status: 'queued'
    });

    try {
        appendLog(ingestion, 'Ingestion queued');

        const extractionBase = await extractFromEmail(message);
        const extraction = await enrichExtraction({
            extraction: extractionBase,
            message,
            sourceContext: options.sourceContext || {}
        });
        ingestion.classification = {
            intent: extraction.intent,
            reason: extraction.reason
        };
        ingestion.extraction = extraction;
        ingestion.confidence = Number(extraction.confidence || 0);

        const mustReview = Boolean(options.forceReview) || ingestion.confidence < autoThreshold();

        if (extraction.intent === 'ignore') {
            ingestion.status = 'ignored';
            appendLog(ingestion, 'AI intent = ignore');
            await ingestion.save();
            return ingestion;
        }

        if (mustReview) {
            ingestion.status = 'needs_review';
            appendLog(ingestion, 'AI output queued for manual review');
            await ingestion.save();
            return ingestion;
        }

        const entityResult = await upsertFromExtraction({
            extraction,
            emailMeta: {
                subject: ingestion.subject,
                fromEmail: ingestion.fromEmail,
                fromName: ingestion.fromName
            }
        });

        ingestion.linkedEntities = {
            clientId: entityResult.clientId,
            opportunityId: entityResult.opportunityId
        };
        ingestion.status = 'processed';
        appendLog(ingestion, 'AI auto-processed successfully');
        await ingestion.save();
        return ingestion;
    } catch (error) {
        // No rule-based fallback: keep item for review with AI error context.
        ingestion.status = 'needs_review';
        ingestion.error = {
            message: error.message || 'AI extraction error',
            stack: error.stack || ''
        };
        appendLog(ingestion, `AI extraction error, moved to review: ${error.message}`);
        await ingestion.save();
        return ingestion;
    }
}

async function approveQueuedItem({ ingestionId, reviewerId, notes }) {
    const doc = await EmailIngestion.findById(ingestionId);
    if (!doc) throw new Error('Ingestion item not found');
    if (doc.status !== 'needs_review' && doc.status !== 'failed') {
        throw new Error(`Item cannot be approved from status: ${doc.status}`);
    }

    const entityResult = await upsertFromExtraction({
        extraction: doc.extraction,
        emailMeta: {
            subject: doc.subject,
            fromEmail: doc.fromEmail,
            fromName: doc.fromName
        }
    });

    doc.decision = {
        action: 'approved',
        notes: notes || '',
        reviewedBy: reviewerId || null,
        reviewedAt: new Date()
    };
    doc.linkedEntities = {
        clientId: entityResult.clientId,
        opportunityId: entityResult.opportunityId
    };
    doc.status = 'processed';
    appendLog(doc, 'Manually approved and processed');
    await doc.save();
    return doc;
}

async function rejectQueuedItem({ ingestionId, reviewerId, notes }) {
    const doc = await EmailIngestion.findById(ingestionId);
    if (!doc) throw new Error('Ingestion item not found');
    if (doc.status !== 'needs_review' && doc.status !== 'failed') {
        throw new Error(`Item cannot be rejected from status: ${doc.status}`);
    }

    doc.decision = {
        action: 'rejected',
        notes: notes || '',
        reviewedBy: reviewerId || null,
        reviewedAt: new Date()
    };
    doc.status = 'ignored';
    appendLog(doc, 'Manually rejected');
    await doc.save();
    return doc;
}

module.exports = {
    processNormalizedEmail,
    approveQueuedItem,
    rejectQueuedItem
};

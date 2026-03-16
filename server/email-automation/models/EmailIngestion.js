const mongoose = require('mongoose');

const EmailIngestionSchema = new mongoose.Schema(
    {
        sourceProvider: { type: String, default: 'outlook_graph' },
        mailbox: { type: String, default: '' },
        internetMessageId: { type: String, index: true, sparse: true },
        graphMessageId: { type: String, index: true, sparse: true },
        conversationId: { type: String, index: true, sparse: true },
        fromEmail: { type: String, default: '' },
        fromName: { type: String, default: '' },
        to: [{ type: String }],
        cc: [{ type: String }],
        subject: { type: String, default: '' },
        bodyText: { type: String, default: '' },
        receivedAt: { type: Date, default: Date.now },
        rawPayload: { type: mongoose.Schema.Types.Mixed },
        classification: {
            intent: {
                type: String,
                enum: ['new_client_opportunity', 'opportunity_update', 'delivery_update', 'ignore'],
                default: 'ignore'
            },
            reason: { type: String, default: '' }
        },
        extraction: { type: mongoose.Schema.Types.Mixed, default: {} },
        confidence: { type: Number, min: 0, max: 1, default: 0 },
        status: {
            type: String,
            enum: ['queued', 'needs_review', 'processed', 'failed', 'ignored'],
            default: 'queued'
        },
        decision: {
            action: { type: String, enum: ['approved', 'rejected'], default: null },
            notes: { type: String, default: '' },
            reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            reviewedAt: { type: Date, default: null }
        },
        linkedEntities: {
            clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
            opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
            calendarEventId: { type: String, default: '' },
            calendarEventWebLink: { type: String, default: '' },
            calendarEventSubject: { type: String, default: '' }
        },
        processingLog: [{
            at: { type: Date, default: Date.now },
            message: { type: String, required: true }
        }],
        error: {
            message: { type: String, default: '' },
            stack: { type: String, default: '' }
        }
    },
    { timestamps: true }
);

EmailIngestionSchema.index({ status: 1, createdAt: -1 });
EmailIngestionSchema.index({ mailbox: 1, receivedAt: -1 });
EmailIngestionSchema.index({ conversationId: 1, receivedAt: -1 });

module.exports = mongoose.models.EmailIngestion || mongoose.model('EmailIngestion', EmailIngestionSchema);

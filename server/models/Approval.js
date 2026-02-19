const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({


    opportunity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Opportunity',
        required: true
    },

    // Approval details
    gpPercent: { type: Number, required: true },
    approvalLevel: {
        type: String,
        enum: ['Manager', 'Director'],
        required: true
    },

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    isRead: { type: Boolean, default: false },

    // Requester (Delivery Team member who submitted)
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestedAt: { type: Date, default: Date.now },

    // Approver details
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Sales Manager or Director
    },

    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: { type: Date },

    // Rejection details
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

    // Financial snapshot at time of approval request
    snapshot: {
        totalExpense: { type: Number },
        gktRevenue: { type: Number },
        grossProfit: { type: Number }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Query-performance indexes
ApprovalSchema.index({ status: 1, approvalLevel: 1, assignedTo: 1, requestedAt: -1 });
ApprovalSchema.index({ opportunity: 1, status: 1 });
ApprovalSchema.index({ requestedBy: 1, requestedAt: -1 });

// Update timestamp on save
ApprovalSchema.pre('save', async function () {
    this.$locals.wasNew = this.isNew;
    this.updatedAt = Date.now();
});

ApprovalSchema.post('save', function (doc) {
    if (!global.io) return;
    global.io.emit('entity_updated', {
        entity: 'approval',
        action: this.$locals?.wasNew ? 'created' : 'updated',
        id: doc._id.toString(),
        updatedAt: doc.updatedAt || new Date()
    });
});

module.exports = mongoose.model('Approval', ApprovalSchema);

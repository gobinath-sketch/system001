const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    opportunityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Opportunity',
        required: true
    },

    documentType: {
        type: String,
        enum: ['Proposal', 'PO', 'Invoice'],
        required: true
    },

    fileName: {
        type: String,
        required: true
    },

    filePath: {
        type: String,
        required: true
    },

    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    },

    version: {
        type: Number,
        default: 1
    },

    isLatest: {
        type: Boolean,
        default: true
    },

    // Role-based visibility
    visibleTo: {
        type: [String],
        default: function () {
            // Default visibility based on document type
            switch (this.documentType) {
                case 'Proposal':
                    return ['Sales Executive', 'Sales Manager', 'Delivery Team', 'Director'];
                case 'PO':
                    return ['Sales Executive', 'Sales Manager', 'Delivery Team', 'Director'];
                case 'Invoice':
                    return ['Sales Executive', 'Sales Manager', 'Delivery Team', 'Director'];
                default:
                    return [];
            }
        }
    }
}, {
    timestamps: true
});

// Index for faster queries
DocumentSchema.index({ opportunityId: 1, documentType: 1 });
DocumentSchema.index({ isLatest: 1 });

// Method to check if user can view this document
DocumentSchema.methods.canView = function (userRole) {
    return this.visibleTo.includes(userRole);
};

// Method to check if user can delete this document
DocumentSchema.methods.canDelete = function (userId) {
    return this.uploadedBy.toString() === userId.toString();
};

module.exports = mongoose.model('Document', DocumentSchema);

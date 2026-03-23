const mongoose = require('mongoose');

const SMESchema = new mongoose.Schema({
    // New top-level classification
    classification: {
        type: String,
        enum: ['Internal', 'External'],
        default: 'External',
        required: true
    },

    smeType: {
        type: String,
        enum: ['Company', 'Freelancer'],
        required: function () { return this.classification === 'External'; },
        // default: 'Freelancer' // Removed default so Internal SMEs don't accidentally get 'Freelancer' type
    },

    // Company specific fields
    companyName: {
        type: String,
        required: function () { return this.classification === 'External' && this.smeType === 'Company'; }
    },
    companyContactNumber: {
        type: String,
        required: function () { return this.classification === 'External' && this.smeType === 'Company'; }
    },
    companyContactPerson: {
        type: String,
        required: function () { return this.classification === 'External' && this.smeType === 'Company'; }
    },
    companyLocation: {
        type: String,
        required: function () { return this.classification === 'External' && this.smeType === 'Company'; }
    },
    companyAddress: {
        type: String,
        required: function () { return this.classification === 'External' && this.smeType === 'Company'; }
    },

    // Legacy reference - keeping for backward compatibility but optional now
    // companyVendor removed

    // Common fields
    name: { // SME Name
        type: String,
        required: true
    },

    email: {
        type: String,
        required: function () { return this.classification === 'Internal' || this.smeType === 'Freelancer'; },
        lowercase: true,
        trim: true
    },

    contactNumber: {
        type: String,
        required: function () { return this.classification === 'Internal' || this.smeType === 'Freelancer'; }
    },

    technology: {
        type: String,
        required: true
    },

    location: {
        type: String,
        required: true
    },

    address: {
        type: String, // For Freelancer/Internal address or general address
        required: function () { return this.classification === 'Internal' || this.smeType === 'Freelancer'; }
    },

    // Bank details (Required for both)
    bankDetails: {
        bankName: { type: String, required: true },
        branchName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        accountHolderName: { type: String, required: true },
        ifscCode: { type: String, required: true, uppercase: true }
    },

    yearsExperience: {
        type: Number,
        required: true
    },

    // Documents & Tax Details
    // Required for both
    gstNo: { type: String, required: true },
    gstDocument: { type: String, required: true },
    panNo: { type: String, required: true },
    panDocument: { type: String, required: true },

    sowDocument: { type: String, required: true },
    ndaDocument: { type: String, required: true },
    sme_profile: { type: String, required: true },

    // Optional
    idProof: { type: String },

    // Availability
    availability: {
        availableFrom: { type: Date },
        availableUntil: { type: Date },
        // Auto-calculated status based on dates
        currentStatus: {
            type: String,
            enum: ['Available', 'Not Available'],
            default: 'Available'
        }
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    isActive: {
        type: Boolean,
        default: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Query-performance indexes
SMESchema.index({ isActive: 1, createdAt: -1 });
SMESchema.index({ smeType: 1, isActive: 1, createdAt: -1 });
SMESchema.index({ createdBy: 1, createdAt: -1 });
SMESchema.index({ technology: 1, isActive: 1 });

SMESchema.index({ classification: 1, isActive: 1 });

SMESchema.pre('save', function () {
    this.$locals.wasNew = this.isNew;

    // Remove smeType for Internal SMEs
    if (this.classification === 'Internal') {
        this.smeType = undefined;
    }

    // Auto-derive availability status purely from dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const avail = this.availability;
    if (avail && avail.availableFrom) {
        const start = new Date(avail.availableFrom);
        start.setHours(0, 0, 0, 0);

        let end = null;
        if (avail.availableUntil) {
            end = new Date(avail.availableUntil);
            end.setHours(23, 59, 59, 999);
        }

        if (today >= start && (!end || today <= end)) {
            avail.currentStatus = 'Available';
        } else {
            avail.currentStatus = 'Not Available';
        }
    } else {
        // No dates set → always available
        if (!this.availability) this.availability = {};
        this.availability.currentStatus = 'Available';
    }
});

SMESchema.post('save', function (doc) {
    if (!global.io) return;
    global.io.emit('entity_updated', {
        entity: 'sme',
        action: this.$locals?.wasNew ? 'created' : 'updated',
        id: doc._id.toString(),
        updatedAt: doc.updatedAt || new Date()
    });
});

module.exports = mongoose.model('SME', SMESchema);

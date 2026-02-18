const mongoose = require('mongoose');

const SMESchema = new mongoose.Schema({
    smeType: {
        type: String,
        enum: ['Company', 'Freelancer'],
        required: true,
        default: 'Freelancer'
    },

    // Company specific fields
    companyName: {
        type: String,
        required: function () { return this.smeType === 'Company'; }
    },
    companyContactNumber: {
        type: String,
        required: function () { return this.smeType === 'Company'; }
    },
    companyContactPerson: {
        type: String,
        required: function () { return this.smeType === 'Company'; }
    },
    companyLocation: {
        type: String,
        required: function () { return this.smeType === 'Company'; }
    },
    companyAddress: {
        type: String,
        required: function () { return this.smeType === 'Company'; }
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
        required: function () { return this.smeType === 'Freelancer'; },
        lowercase: true,
        trim: true
    },

    contactNumber: {
        type: String,
        required: function () { return this.smeType === 'Freelancer'; }
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
        type: String, // For Freelancer address or general address
        required: function () { return this.smeType === 'Freelancer'; }
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

// Index for faster queries
SMESchema.index({ companyVendor: 1 });
SMESchema.index({ smeType: 1 });

module.exports = mongoose.model('SME', SMESchema);

const mongoose = require('mongoose');

const ContactPersonSchema = new mongoose.Schema({
    name: { type: String },
    designation: { type: String },
    department: { type: String }, // Optional Department
    contactNumber: { type: String },
    email: { type: String },
    location: { type: String, required: true }, // Moved from Client root
    linkedIn: { type: String }, // Optional LinkedIn URL


    // Reporting Manager (Optional)
    reportingManager: {
        name: { type: String },
        designation: { type: String },
        contactNumber: { type: String },
        email: { type: String }
    },

    isPrimary: { type: Boolean, default: false }, // Mark primary contact
    createdAt: { type: Date, default: Date.now }
});

const ClientSchema = new mongoose.Schema({
    companyName: { type: String, required: true },

    // Sector type
    sector: {
        type: String,
        enum: ['Corporate', 'Enterprise', 'Academics', 'University', 'College', 'School'],
        required: true
    },

    // location: { type: String, required: true }, // Removed from here

    // Multiple contact persons
    contactPersons: [ContactPersonSchema],

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

// Query-performance indexes
ClientSchema.index({ createdBy: 1, createdAt: -1 });
ClientSchema.index({ companyName: 1 });
ClientSchema.index({ sector: 1, createdAt: -1 });

ClientSchema.pre('save', function (next) {
    this.$locals.wasNew = this.isNew;
    next();
});

ClientSchema.post('save', function (doc) {
    if (!global.io) return;
    global.io.emit('entity_updated', {
        entity: 'client',
        action: this.$locals?.wasNew ? 'created' : 'updated',
        id: doc._id.toString(),
        updatedAt: new Date()
    });
});

module.exports = mongoose.models.Client || mongoose.model('Client', ClientSchema);

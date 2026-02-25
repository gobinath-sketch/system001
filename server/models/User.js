const mongoose = require('mongoose');

const ProfileSettingsSchema = new mongoose.Schema({
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    backupEmail: { type: String, default: '' },
    phone: { type: String, default: '' },
    designation: { type: String, default: '' },
    department: { type: String, default: '' },
    language: { type: String, default: 'English' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    weekStartsOn: { type: String, default: 'Monday' },
    avatarDataUrl: { type: String, default: '' }
}, { _id: false });

const PreferencesSettingsSchema = new mongoose.Schema({
    compactTables: { type: Boolean, default: false },
    reducedMotion: { type: Boolean, default: false },
    defaultLanding: { type: String, default: 'Dashboard' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    numberFormat: { type: String, default: 'Indian' },
    defaultRows: { type: String, default: '25' },
    defaultCurrency: { type: String, enum: ['INR', 'USD'], default: 'INR' },
    savedPresets: {
        type: [{
            name: { type: String, default: '' },
            defaultCurrency: { type: String, enum: ['INR', 'USD'], default: 'INR' },
            defaultLanding: { type: String, default: 'Dashboard' },
            dateFormat: { type: String, default: 'DD/MM/YYYY' },
            numberFormat: { type: String, default: 'Indian' },
            createdAt: { type: Date, default: Date.now }
        }],
        default: []
    }
}, { _id: false });

const WorkspaceSettingsSchema = new mongoose.Schema({
    autoLogout: { type: String, default: '30m' },
    enableTwoFactor: { type: Boolean, default: false },
    workingHours: { type: String, default: '09:00-18:00' },
    alertMode: { type: String, default: 'Balanced' },
    lastLocaleSyncAt: { type: Date, default: null },
    lastDataExportAt: { type: Date, default: null },
    deactivationStatus: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none'
    },
    deactivationRequestedAt: { type: Date, default: null }
}, { _id: false });

const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    device: { type: String, default: 'Unknown Device' },
    location: { type: String, default: 'Unknown Location' },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now }
}, { _id: false });

const SettingsSchema = new mongoose.Schema({
    profile: { type: ProfileSettingsSchema, default: () => ({}) },
    preferences: { type: PreferencesSettingsSchema, default: () => ({}) },
    workspace: { type: WorkspaceSettingsSchema, default: () => ({}) },
    security: {
        sessions: { type: [SessionSchema], default: [] },
        passwordResetRequestedAt: { type: Date, default: null }
    }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['Director', 'Business Head', 'Sales Manager', 'Sales Executive', 'Delivery Team', 'Finance'],
        required: true
    },
    creatorCode: { type: String, required: true },
    reportingManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    targets: [{
        year: { type: Number, required: true },
        period: { type: String, enum: ['Yearly', 'Half-Yearly', 'Quarterly'], required: true },
        amount: { type: Number, required: true }
    }],
    achievedTargets: [{
        year: Number,
        period: String,
        notifiedAt: { type: Date, default: Date.now }
    }],
    settings: { type: SettingsSchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now }
});

// Query-performance indexes
UserSchema.index({ reportingManager: 1, role: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ creatorCode: 1 });

UserSchema.pre('save', function () {
    this.$locals.wasNew = this.isNew;
});

UserSchema.post('save', function (doc) {
    if (!global.io) return;
    global.io.emit('entity_updated', {
        entity: 'user',
        action: this.$locals?.wasNew ? 'created' : 'updated',
        id: doc._id.toString(),
        updatedAt: new Date()
    });
});

module.exports = mongoose.model('User', UserSchema);

const mongoose = require('mongoose');

const GraphUserTokenSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        accessToken: { type: String, required: true },
        refreshToken: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        scopes: { type: [String], default: [] }
    },
    { timestamps: true }
);

GraphUserTokenSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.models.GraphUserToken || mongoose.model('GraphUserToken', GraphUserTokenSchema);


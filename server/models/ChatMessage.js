const mongoose = require('mongoose');

const ChatAttachmentSchema = new mongoose.Schema({
    originalName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    path: { type: String, default: '' },
    provider: { type: String, default: 'local' },
    key: { type: String, default: '' },
    url: { type: String, default: '' }
}, { _id: false });

const ChatMessageSchema = new mongoose.Schema({
    participantsKey: { type: String, required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, default: '', trim: true, maxlength: 3000 },
    attachment: { type: ChatAttachmentSchema, default: null },
    readAt: { type: Date, default: null },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    editedAt: { type: Date, default: null },
    deletedForEveryoneAt: { type: Date, default: null },
    deletedForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isForwarded: { type: Boolean, default: false },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage', default: null }
}, { timestamps: true });

ChatMessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
ChatMessageSchema.index({ receiver: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);

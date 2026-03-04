const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const {
    CHAT_DIR,
    getFeatureConfig,
    buildFileName,
    toUploadRelativePath,
    persistAttachment
} = require('../utils/chatStorage');

const router = express.Router();

const CHUNK_ROOT_DIR = path.join(CHAT_DIR, '_chunks');
if (!fs.existsSync(CHUNK_ROOT_DIR)) {
    fs.mkdirSync(CHUNK_ROOT_DIR, { recursive: true });
}

const inMemoryUploadSessions = new Map();

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, CHAT_DIR);
    },
    filename(req, file, cb) {
        cb(null, buildFileName(file.originalname || 'file'));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: getFeatureConfig().singleUploadLimitBytes },
    fileFilter(req, file, cb) {
        return cb(null, true);
    }
});

const createChunkUpload = () => multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            const uploadId = String(req.params.uploadId || '');
            const sessionDir = path.join(CHUNK_ROOT_DIR, uploadId);
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            cb(null, sessionDir);
        },
        filename(req, file, cb) {
            const index = Number.parseInt(String(req.query.index || req.body?.index || '0'), 10) || 0;
            cb(null, `chunk-${String(index).padStart(6, '0')}.part`);
        }
    }),
    limits: { fileSize: getFeatureConfig().chunkSizeBytes + 512 * 1024 },
    fileFilter(req, file, cb) {
        return cb(null, true);
    }
});

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const getParticipantsKey = (id1, id2) => [String(id1), String(id2)].sort().join(':');

const getPreviewMessage = (message) => {
    if (!message) return null;
    const sender = message.sender && typeof message.sender === 'object'
        ? {
            _id: String(message.sender._id || message.sender),
            name: message.sender.name || '',
            role: message.sender.role || '',
            avatarDataUrl: message.sender.settings?.profile?.avatarDataUrl || ''
        }
        : { _id: String(message.sender || '') };
    return {
        _id: String(message._id),
        sender,
        text: message.text || '',
        attachment: message.attachment || null,
        deletedForEveryoneAt: message.deletedForEveryoneAt || null,
        createdAt: message.createdAt
    };
};

const serializeMessage = (message) => ({
    _id: String(message._id),
    sender: message.sender && typeof message.sender === 'object' ? {
        _id: String(message.sender._id || message.sender),
        name: message.sender.name || '',
        role: message.sender.role || '',
        avatarDataUrl: message.sender.settings?.profile?.avatarDataUrl || ''
    } : { _id: String(message.sender) },
    receiver: message.receiver && typeof message.receiver === 'object' ? {
        _id: String(message.receiver._id || message.receiver),
        name: message.receiver.name || '',
        role: message.receiver.role || '',
        avatarDataUrl: message.receiver.settings?.profile?.avatarDataUrl || ''
    } : { _id: String(message.receiver) },
    text: message.text || '',
    attachment: message.attachment || null,
    readAt: message.readAt || null,
    replyTo: getPreviewMessage(message.replyTo),
    editedAt: message.editedAt || null,
    deletedForEveryoneAt: message.deletedForEveryoneAt || null,
    isForwarded: Boolean(message.isForwarded),
    forwardedFrom: getPreviewMessage(message.forwardedFrom),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
});

const emitMessage = (senderId, receiverId, payload) => {
    if (!global.io) return;
    global.io.to(String(senderId)).emit('chat_message:new', payload);
    global.io.to(String(receiverId)).emit('chat_message:new', payload);
};

const emitMessageUpdated = (senderId, receiverId, payload) => {
    if (!global.io) return;
    global.io.to(String(senderId)).emit('chat_message:updated', payload);
    global.io.to(String(receiverId)).emit('chat_message:updated', payload);
};

const createAndEmitMessage = async ({ senderId, receiverId, text, attachment, replyTo = null, isForwarded = false, forwardedFrom = null }) => {
    const message = await ChatMessage.create({
        participantsKey: getParticipantsKey(senderId, receiverId),
        sender: senderId,
        receiver: receiverId,
        text: String(text || '').trim(),
        attachment: attachment || null,
        replyTo: replyTo || null,
        isForwarded: Boolean(isForwarded),
        forwardedFrom: forwardedFrom || null
    });
    const populated = await ChatMessage.findById(message._id)
        .populate('sender', 'name role settings.profile.avatarDataUrl')
        .populate('receiver', 'name role settings.profile.avatarDataUrl')
        .populate({
            path: 'replyTo',
            select: '_id sender text attachment deletedForEveryoneAt createdAt',
            populate: { path: 'sender', select: 'name role settings.profile.avatarDataUrl' }
        })
        .populate({
            path: 'forwardedFrom',
            select: '_id sender text attachment deletedForEveryoneAt createdAt',
            populate: { path: 'sender', select: 'name role settings.profile.avatarDataUrl' }
        });
    const payload = serializeMessage(populated);
    emitMessage(senderId, receiverId, payload);
    return payload;
};

const removeDirectorySafe = (dirPath) => {
    try {
        if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
        console.error('Failed to clean up temp directory:', dirPath, err.message);
    }
};

router.get('/uploads/config', protect, async (req, res) => {
    const cfg = getFeatureConfig();
    res.json({
        enabled: cfg.largeUploadEnabled,
        maxFileSizeBytes: cfg.maxFileSizeBytes,
        singleUploadLimitBytes: cfg.singleUploadLimitBytes,
        chunkSizeBytes: cfg.chunkSizeBytes
    });
});

router.get('/users', protect, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } })
            .select('_id name role settings.profile.avatarDataUrl')
            .sort({ name: 1 });

        res.json(users.map((user) => ({
            _id: String(user._id),
            name: user.name,
            role: user.role,
            avatarDataUrl: user.settings?.profile?.avatarDataUrl || ''
        })));
    } catch (err) {
        console.error('Failed to load chat users:', err);
        res.status(500).json({ message: 'Failed to load users' });
    }
});

router.get('/conversations', protect, async (req, res) => {
    try {
        const currentUserId = toObjectId(req.user._id);

        const conversations = await ChatMessage.aggregate([
            {
                $match: {
                    $or: [{ sender: currentUserId }, { receiver: currentUserId }],
                    deletedForUsers: { $ne: currentUserId }
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $addFields: {
                    otherUserId: {
                        $cond: [{ $eq: ['$sender', currentUserId] }, '$receiver', '$sender']
                    },
                    unreadWeight: {
                        $cond: [{ $and: [{ $eq: ['$receiver', currentUserId] }, { $eq: ['$readAt', null] }] }, 1, 0]
                    }
                }
            },
            {
                $group: {
                    _id: '$otherUserId',
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: { $sum: '$unreadWeight' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'otherUser'
                }
            },
            { $unwind: '$otherUser' },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        res.json(conversations.map((row) => ({
            user: {
                _id: String(row.otherUser._id),
                name: row.otherUser.name,
                role: row.otherUser.role,
                avatarDataUrl: row.otherUser.settings?.profile?.avatarDataUrl || ''
            },
            unreadCount: row.unreadCount || 0,
            lastMessage: {
                _id: String(row.lastMessage._id),
                sender: String(row.lastMessage.sender),
                receiver: String(row.lastMessage.receiver),
                text: row.lastMessage.text || '',
                attachment: row.lastMessage.attachment || null,
                readAt: row.lastMessage.readAt || null,
                deletedForEveryoneAt: row.lastMessage.deletedForEveryoneAt || null,
                createdAt: row.lastMessage.createdAt
            }
        })));
    } catch (err) {
        console.error('Failed to load chat conversations:', err);
        res.status(500).json({ message: 'Failed to load conversations' });
    }
});

router.get('/messages/:otherUserId', protect, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const limit = Math.min(Number.parseInt(String(req.query.limit || '50'), 10) || 50, 100);
        const before = req.query.before ? new Date(String(req.query.before)) : null;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        const otherUser = await User.findById(otherUserId).select('_id name role settings.profile.avatarDataUrl');
        if (!otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const query = {
            $or: [
                { sender: req.user._id, receiver: otherUserId },
                { sender: otherUserId, receiver: req.user._id }
            ],
            deletedForUsers: { $ne: toObjectId(req.user._id) }
        };
        if (before && !Number.isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'name role settings.profile.avatarDataUrl')
            .populate('receiver', 'name role settings.profile.avatarDataUrl')
            .populate({
                path: 'replyTo',
                select: '_id sender text attachment deletedForEveryoneAt createdAt',
                populate: { path: 'sender', select: 'name role settings.profile.avatarDataUrl' }
            })
            .populate({
                path: 'forwardedFrom',
                select: '_id sender text attachment deletedForEveryoneAt createdAt',
                populate: { path: 'sender', select: 'name role settings.profile.avatarDataUrl' }
            });

        res.json({
            user: {
                _id: String(otherUser._id),
                name: otherUser.name,
                role: otherUser.role,
                avatarDataUrl: otherUser.settings?.profile?.avatarDataUrl || ''
            },
            messages: messages.reverse().map((msg) => serializeMessage(msg))
        });
    } catch (err) {
        console.error('Failed to load chat messages:', err);
        res.status(500).json({ message: 'Failed to load messages' });
    }
});

router.post('/messages', protect, (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        try {
            const { receiverId } = req.body || {};
            const text = String(req.body?.text || '').trim();
            const replyToMessageId = String(req.body?.replyToMessageId || '').trim();
            const forwardFromMessageId = String(req.body?.forwardFromMessageId || '').trim();
            const cfg = getFeatureConfig();

            if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
                return res.status(400).json({ message: 'Receiver is required' });
            }
            if (String(receiverId) === String(req.user._id)) {
                return res.status(400).json({ message: 'Cannot send message to yourself' });
            }
            if (!text && !req.file) {
                return res.status(400).json({ message: 'Message text or file is required' });
            }

            const receiver = await User.findById(receiverId).select('_id');
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }

            if (req.file && Number(req.file.size || 0) > cfg.maxFileSizeBytes) {
                return res.status(400).json({ message: `File exceeds ${Math.round(cfg.maxFileSizeBytes / (1024 * 1024))}MB limit` });
            }

            let replyTo = null;
            if (replyToMessageId) {
                if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
                    return res.status(400).json({ message: 'Invalid reply target' });
                }
                replyTo = await ChatMessage.findOne({
                    _id: replyToMessageId,
                    participantsKey: getParticipantsKey(req.user._id, receiverId)
                }).select('_id');
                if (!replyTo) return res.status(404).json({ message: 'Reply target not found' });
            }

            let forwardedFrom = null;
            if (forwardFromMessageId) {
                if (!mongoose.Types.ObjectId.isValid(forwardFromMessageId)) {
                    return res.status(400).json({ message: 'Invalid forward source' });
                }
                forwardedFrom = await ChatMessage.findOne({
                    _id: forwardFromMessageId,
                    $or: [{ sender: req.user._id }, { receiver: req.user._id }],
                    deletedForUsers: { $ne: toObjectId(req.user._id) }
                }).select('_id');
                if (!forwardedFrom) return res.status(404).json({ message: 'Forward source not found' });
            }

            let attachment = null;
            if (req.file) {
                const persisted = await persistAttachment({
                    sourcePath: req.file.path,
                    originalName: req.file.originalname || '',
                    mimeType: req.file.mimetype || ''
                });
                attachment = {
                    originalName: req.file.originalname || '',
                    mimeType: req.file.mimetype || '',
                    size: Number(req.file.size || 0),
                    path: persisted.path || '',
                    provider: persisted.provider || 'local',
                    key: persisted.key || '',
                    url: persisted.url || ''
                };
            }

            const payload = await createAndEmitMessage({
                senderId: req.user._id,
                receiverId,
                text,
                attachment,
                replyTo: replyTo?._id || null,
                isForwarded: Boolean(forwardedFrom),
                forwardedFrom: forwardedFrom?._id || null
            });

            return res.status(201).json(payload);
        } catch (sendErr) {
            console.error('Failed to send chat message:', sendErr);
            return res.status(500).json({ message: 'Failed to send message' });
        }
    });
});

router.post('/uploads/initiate', protect, async (req, res) => {
    try {
        const cfg = getFeatureConfig();
        if (!cfg.largeUploadEnabled) {
            return res.status(403).json({ message: 'Large upload feature is disabled' });
        }

        const receiverId = String(req.body?.receiverId || '').trim();
        const originalName = String(req.body?.fileName || 'file').trim();
        const mimeType = String(req.body?.mimeType || '').trim();
        const fileSize = Number.parseInt(String(req.body?.fileSize || '0'), 10);

        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({ message: 'Receiver is required' });
        }
        if (String(receiverId) === String(req.user._id)) {
            return res.status(400).json({ message: 'Cannot send file to yourself' });
        }
        if (!Number.isFinite(fileSize) || fileSize <= 0) {
            return res.status(400).json({ message: 'Invalid file size' });
        }
        if (fileSize > cfg.maxFileSizeBytes) {
            return res.status(400).json({ message: `File exceeds ${Math.round(cfg.maxFileSizeBytes / (1024 * 1024))}MB limit` });
        }
        const receiver = await User.findById(receiverId).select('_id');
        if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

        const uploadId = new mongoose.Types.ObjectId().toString();
        const totalChunks = Math.max(1, Math.ceil(fileSize / cfg.chunkSizeBytes));
        const sessionDir = path.join(CHUNK_ROOT_DIR, uploadId);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        inMemoryUploadSessions.set(uploadId, {
            uploadId,
            senderId: String(req.user._id),
            receiverId,
            originalName,
            mimeType: mimeType || 'application/octet-stream',
            fileSize,
            chunkSizeBytes: cfg.chunkSizeBytes,
            totalChunks,
            sessionDir,
            uploaded: new Set(),
            createdAt: Date.now()
        });

        return res.status(201).json({
            uploadId,
            chunkSizeBytes: cfg.chunkSizeBytes,
            totalChunks,
            maxFileSizeBytes: cfg.maxFileSizeBytes
        });
    } catch (err) {
        console.error('Failed to initiate chunk upload:', err);
        return res.status(500).json({ message: 'Failed to start upload' });
    }
});

router.post('/uploads/:uploadId/chunk', protect, (req, res) => {
    const uploadId = String(req.params.uploadId || '');
    const session = inMemoryUploadSessions.get(uploadId);
    if (!session) return res.status(404).json({ message: 'Upload session not found' });
    if (String(session.senderId) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized for this upload session' });
    }

    const chunkUpload = createChunkUpload();
    chunkUpload.single('chunk')(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err.message || 'Chunk upload failed' });
        try {
            const index = Number.parseInt(String(req.query.index || req.body?.index || '0'), 10);
            if (!Number.isFinite(index) || index < 0 || index >= session.totalChunks) {
                return res.status(400).json({ message: 'Invalid chunk index' });
            }
            if (!req.file) return res.status(400).json({ message: 'Chunk file is required' });

            session.uploaded.add(index);
            return res.json({ ok: true, uploadedChunks: session.uploaded.size, totalChunks: session.totalChunks });
        } catch (chunkErr) {
            console.error('Failed to process chunk:', chunkErr);
            return res.status(500).json({ message: 'Failed to process chunk' });
        }
    });
});

router.post('/uploads/:uploadId/complete', protect, async (req, res) => {
    const uploadId = String(req.params.uploadId || '');
    const session = inMemoryUploadSessions.get(uploadId);
    if (!session) return res.status(404).json({ message: 'Upload session not found' });
    if (String(session.senderId) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized for this upload session' });
    }

    try {
        if (session.uploaded.size !== session.totalChunks) {
            return res.status(400).json({ message: 'All chunks are not uploaded yet' });
        }

        const mergedTempPath = path.join(session.sessionDir, `merged-${buildFileName(session.originalName)}`);
        const writeStream = fs.createWriteStream(mergedTempPath);
        for (let i = 0; i < session.totalChunks; i += 1) {
            const chunkPath = path.join(session.sessionDir, `chunk-${String(i).padStart(6, '0')}.part`);
            if (!fs.existsSync(chunkPath)) {
                writeStream.close();
                throw new Error(`Missing chunk ${i}`);
            }
            const data = fs.readFileSync(chunkPath);
            writeStream.write(data);
        }
        writeStream.end();
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        const stat = fs.statSync(mergedTempPath);
        const persisted = await persistAttachment({
            sourcePath: mergedTempPath,
            originalName: session.originalName,
            mimeType: session.mimeType
        });

        const replyToMessageId = String(req.body?.replyToMessageId || '').trim();
        const forwardFromMessageId = String(req.body?.forwardFromMessageId || '').trim();

        let replyTo = null;
        if (replyToMessageId) {
            if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
                return res.status(400).json({ message: 'Invalid reply target' });
            }
            replyTo = await ChatMessage.findOne({
                _id: replyToMessageId,
                participantsKey: getParticipantsKey(req.user._id, session.receiverId)
            }).select('_id');
            if (!replyTo) return res.status(404).json({ message: 'Reply target not found' });
        }

        let forwardedFrom = null;
        if (forwardFromMessageId) {
            if (!mongoose.Types.ObjectId.isValid(forwardFromMessageId)) {
                return res.status(400).json({ message: 'Invalid forward source' });
            }
            forwardedFrom = await ChatMessage.findOne({
                _id: forwardFromMessageId,
                $or: [{ sender: req.user._id }, { receiver: req.user._id }],
                deletedForUsers: { $ne: toObjectId(req.user._id) }
            }).select('_id');
            if (!forwardedFrom) return res.status(404).json({ message: 'Forward source not found' });
        }

        const payload = await createAndEmitMessage({
            senderId: req.user._id,
            receiverId: session.receiverId,
            text: String(req.body?.text || '').trim(),
            replyTo: replyTo?._id || null,
            isForwarded: Boolean(forwardedFrom),
            forwardedFrom: forwardedFrom?._id || null,
            attachment: {
                originalName: session.originalName,
                mimeType: session.mimeType,
                size: Number(stat.size || session.fileSize || 0),
                path: persisted.path || '',
                provider: persisted.provider || 'local',
                key: persisted.key || '',
                url: persisted.url || ''
            }
        });

        inMemoryUploadSessions.delete(uploadId);
        removeDirectorySafe(session.sessionDir);

        return res.status(201).json(payload);
    } catch (err) {
        console.error('Failed to complete chunk upload:', err);
        return res.status(500).json({ message: 'Failed to finalize upload' });
    }
});

router.patch('/messages/:messageId', protect, async (req, res) => {
    try {
        const { messageId } = req.params;
        const text = String(req.body?.text || '').trim();
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message id' });
        }
        if (!text) return res.status(400).json({ message: 'Message text is required' });

        const message = await ChatMessage.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        if (String(message.sender) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You can edit only your own messages' });
        }
        if (message.deletedForEveryoneAt) {
            return res.status(400).json({ message: 'Deleted message cannot be edited' });
        }

        message.text = text;
        message.editedAt = new Date();
        await message.save();

        const populated = await ChatMessage.findById(message._id)
            .populate('sender', 'name role settings.profile.avatarDataUrl')
            .populate('receiver', 'name role settings.profile.avatarDataUrl')
            .populate({
                path: 'replyTo',
                select: '_id sender text attachment deletedForEveryoneAt createdAt',
                populate: { path: 'sender', select: 'name role settings.profile.avatarDataUrl' }
            })
            .populate({
                path: 'forwardedFrom',
                select: '_id sender text attachment deletedForEveryoneAt createdAt',
                populate: { path: 'sender', select: 'name role settings.profile.avatarDataUrl' }
            });
        const payload = serializeMessage(populated);
        emitMessageUpdated(populated.sender._id, populated.receiver._id, payload);

        return res.json(payload);
    } catch (err) {
        console.error('Failed to edit message:', err);
        return res.status(500).json({ message: 'Failed to edit message' });
    }
});

router.post('/messages/:messageId/forward', protect, async (req, res) => {
    try {
        const { messageId } = req.params;
        const receiverIds = Array.isArray(req.body?.receiverIds) ? req.body.receiverIds : [];
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message id' });
        }
        if (!receiverIds.length) {
            return res.status(400).json({ message: 'At least one receiver is required' });
        }

        const source = await ChatMessage.findOne({
            _id: messageId,
            $or: [{ sender: req.user._id }, { receiver: req.user._id }],
            deletedForUsers: { $ne: toObjectId(req.user._id) }
        });
        if (!source) return res.status(404).json({ message: 'Message not found' });
        if (source.deletedForEveryoneAt) {
            return res.status(400).json({ message: 'Deleted message cannot be forwarded' });
        }
        if (!source.text && !source.attachment) {
            return res.status(400).json({ message: 'Nothing to forward' });
        }

        const uniqueReceiverIds = [...new Set(receiverIds.map((id) => String(id).trim()).filter(Boolean))]
            .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== String(req.user._id));
        if (!uniqueReceiverIds.length) {
            return res.status(400).json({ message: 'No valid receiver selected' });
        }

        const existingUsers = await User.find({ _id: { $in: uniqueReceiverIds } }).select('_id');
        const allowedReceiverIds = new Set(existingUsers.map((u) => String(u._id)));
        const payloads = [];
        for (const receiverId of uniqueReceiverIds) {
            if (!allowedReceiverIds.has(receiverId)) continue;
            // Clone attachment metadata to preserve source file reference.
            const attachment = source.attachment ? { ...source.attachment } : null;
            // eslint-disable-next-line no-await-in-loop
            const payload = await createAndEmitMessage({
                senderId: req.user._id,
                receiverId,
                text: source.text || '',
                attachment,
                isForwarded: true,
                forwardedFrom: source._id
            });
            payloads.push(payload);
        }

        return res.status(201).json({ messages: payloads });
    } catch (err) {
        console.error('Failed to forward message:', err);
        return res.status(500).json({ message: 'Failed to forward message' });
    }
});

router.delete('/messages/:messageId', protect, async (req, res) => {
    try {
        const { messageId } = req.params;
        const mode = String(req.body?.mode || 'me').trim().toLowerCase();
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message id' });
        }
        if (!['me', 'everyone'].includes(mode)) {
            return res.status(400).json({ message: 'Invalid delete mode' });
        }

        const message = await ChatMessage.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });

        const isParticipant = String(message.sender) === String(req.user._id) || String(message.receiver) === String(req.user._id);
        if (!isParticipant) return res.status(403).json({ message: 'Not authorized for this message' });

        if (mode === 'me') {
            await ChatMessage.updateOne(
                { _id: messageId },
                { $addToSet: { deletedForUsers: toObjectId(req.user._id) } }
            );
            if (global.io) {
                global.io.to(String(req.user._id)).emit('chat_message:hidden', {
                    messageId: String(messageId),
                    userId: String(req.user._id)
                });
            }
            return res.json({ messageId: String(messageId), mode: 'me' });
        }

        if (String(message.sender) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Only sender can delete for everyone' });
        }
        if (message.deletedForEveryoneAt) {
            return res.status(400).json({ message: 'Message already deleted for everyone' });
        }

        message.deletedForEveryoneAt = new Date();
        message.text = '';
        message.attachment = null;
        message.replyTo = null;
        message.forwardedFrom = null;
        message.isForwarded = false;
        message.readAt = message.readAt || new Date();
        await message.save();

        const populated = await ChatMessage.findById(message._id)
            .populate('sender', 'name role settings.profile.avatarDataUrl')
            .populate('receiver', 'name role settings.profile.avatarDataUrl');
        const payload = serializeMessage(populated);
        emitMessageUpdated(populated.sender._id, populated.receiver._id, payload);

        return res.json({ mode: 'everyone', message: payload });
    } catch (err) {
        console.error('Failed to delete message:', err);
        return res.status(500).json({ message: 'Failed to delete message' });
    }
});

router.delete('/uploads/:uploadId', protect, async (req, res) => {
    const uploadId = String(req.params.uploadId || '');
    const session = inMemoryUploadSessions.get(uploadId);
    if (!session) return res.status(204).send();
    if (String(session.senderId) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized for this upload session' });
    }
    inMemoryUploadSessions.delete(uploadId);
    removeDirectorySafe(session.sessionDir);
    return res.status(204).send();
});

router.post('/conversations/:otherUserId/read', protect, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        const now = new Date();
        const update = await ChatMessage.updateMany(
            {
                sender: otherUserId,
                receiver: req.user._id,
                readAt: null
            },
            { $set: { readAt: now } }
        );

        if (global.io && update.modifiedCount > 0) {
            global.io.to(String(otherUserId)).emit('chat_message:read', {
                by: String(req.user._id),
                forUserId: String(otherUserId),
                readAt: now.toISOString()
            });
        }

        res.json({ updatedCount: update.modifiedCount || 0, readAt: now.toISOString() });
    } catch (err) {
        console.error('Failed to mark conversation as read:', err);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
});

module.exports = router;

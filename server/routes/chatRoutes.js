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

const allowedMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'video/mp4',
    'video/quicktime'
]);

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
        if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
        return cb(new Error('Unsupported file type'));
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
        if (!file.mimetype || allowedMimeTypes.has(file.mimetype) || file.mimetype === 'application/octet-stream') {
            return cb(null, true);
        }
        return cb(new Error('Unsupported file type'));
    }
});

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const getParticipantsKey = (id1, id2) => [String(id1), String(id2)].sort().join(':');

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
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
});

const emitMessage = (senderId, receiverId, payload) => {
    if (!global.io) return;
    global.io.to(String(senderId)).emit('chat_message:new', payload);
    global.io.to(String(receiverId)).emit('chat_message:new', payload);
};

const createAndEmitMessage = async ({ senderId, receiverId, text, attachment }) => {
    const message = await ChatMessage.create({
        participantsKey: getParticipantsKey(senderId, receiverId),
        sender: senderId,
        receiver: receiverId,
        text: String(text || '').trim(),
        attachment: attachment || null
    });
    const populated = await ChatMessage.findById(message._id)
        .populate('sender', 'name role settings.profile.avatarDataUrl')
        .populate('receiver', 'name role settings.profile.avatarDataUrl');
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
                    $or: [{ sender: currentUserId }, { receiver: currentUserId }]
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
            ]
        };
        if (before && !Number.isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'name role settings.profile.avatarDataUrl')
            .populate('receiver', 'name role settings.profile.avatarDataUrl');

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
                attachment
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
        if (mimeType && !allowedMimeTypes.has(mimeType)) {
            return res.status(400).json({ message: 'Unsupported file type' });
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

        const payload = await createAndEmitMessage({
            senderId: req.user._id,
            receiverId: session.receiverId,
            text: String(req.body?.text || '').trim(),
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

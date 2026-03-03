const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');
const CHAT_DIR = path.join(SERVER_ROOT, 'uploads', 'chat');

if (!fs.existsSync(CHAT_DIR)) {
    fs.mkdirSync(CHAT_DIR, { recursive: true });
}

const parseIntEnv = (value, fallback) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getFeatureConfig = () => ({
    largeUploadEnabled: String(process.env.CHAT_LARGE_UPLOADS_ENABLED || 'true').toLowerCase() !== 'false',
    maxFileSizeBytes: parseIntEnv(process.env.CHAT_MAX_FILE_SIZE_BYTES, 500 * 1024 * 1024),
    singleUploadLimitBytes: parseIntEnv(process.env.CHAT_SINGLE_UPLOAD_LIMIT_BYTES, 15 * 1024 * 1024),
    chunkSizeBytes: parseIntEnv(process.env.CHAT_CHUNK_SIZE_BYTES, 5 * 1024 * 1024)
});

const sanitizeFileName = (name = 'file') => {
    return String(name)
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || 'file';
};

const buildFileName = (originalName) => {
    const ext = path.extname(originalName || '').toLowerCase();
    const base = sanitizeFileName(path.basename(originalName || 'file', ext));
    return `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`;
};

const toUploadRelativePath = (filePath) => {
    if (!filePath) return '';
    const normalized = String(filePath).replace(/\\/g, '/');
    const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
    if (uploadsIndex >= 0) return normalized.slice(uploadsIndex + 1);
    if (normalized.toLowerCase().startsWith('uploads/')) return normalized;
    const relative = path.relative(SERVER_ROOT, filePath).replace(/\\/g, '/');
    if (relative && !relative.startsWith('..')) return relative;
    return normalized.replace(/^\/+/, '');
};

const moveFileIntoChatStore = (sourcePath, originalName) => {
    const finalName = buildFileName(originalName);
    const destination = path.join(CHAT_DIR, finalName);
    fs.renameSync(sourcePath, destination);
    return {
        provider: 'local',
        key: '',
        url: '',
        path: toUploadRelativePath(destination)
    };
};

const uploadToS3 = async ({ sourcePath, originalName, mimeType }) => {
    const bucket = String(process.env.CHAT_S3_BUCKET || '').trim();
    const region = String(process.env.CHAT_S3_REGION || '').trim();
    const accessKeyId = String(process.env.CHAT_S3_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = String(process.env.CHAT_S3_SECRET_ACCESS_KEY || '').trim();

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
        throw new Error('S3 storage selected but CHAT_S3_* credentials are missing');
    }

    // Lazy-require so local mode works without AWS SDK dependency.
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey }
    });

    const key = `chat/${buildFileName(originalName)}`;
    const body = fs.readFileSync(sourcePath);

    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mimeType || 'application/octet-stream'
    }));

    fs.unlinkSync(sourcePath);

    const customBase = String(process.env.CHAT_S3_PUBLIC_BASE_URL || '').trim();
    const url = customBase
        ? `${customBase.replace(/\/+$/, '')}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
        provider: 's3',
        key,
        url,
        path: ''
    };
};

const persistAttachment = async ({ sourcePath, originalName, mimeType }) => {
    const provider = String(process.env.CHAT_STORAGE_PROVIDER || 'local').trim().toLowerCase();
    if (provider === 's3') {
        return uploadToS3({ sourcePath, originalName, mimeType });
    }
    return moveFileIntoChatStore(sourcePath, originalName);
};

module.exports = {
    CHAT_DIR,
    getFeatureConfig,
    sanitizeFileName,
    buildFileName,
    toUploadRelativePath,
    persistAttachment
};

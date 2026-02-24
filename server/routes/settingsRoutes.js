const express = require('express');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

const SETTINGS_ALLOWED_FIELDS = {
    profile: ['firstName', 'lastName', 'email', 'backupEmail', 'phone', 'designation', 'department', 'language', 'timezone', 'weekStartsOn', 'avatarDataUrl'],
    preferences: ['compactTables', 'reducedMotion', 'defaultLanding', 'dateFormat', 'numberFormat', 'defaultRows', 'defaultCurrency', 'savedPresets'],
    workspace: ['autoLogout', 'enableTwoFactor', 'workingHours', 'alertMode']
};

const getDeviceName = (userAgent = '') => {
    const ua = userAgent.toLowerCase();
    const platform = ua.includes('windows') ? 'Windows'
        : ua.includes('android') ? 'Android'
            : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios') ? 'iOS'
                : ua.includes('mac os') ? 'macOS'
                    : ua.includes('linux') ? 'Linux'
                        : 'Unknown OS';

    const browser = ua.includes('edg') ? 'Edge'
        : ua.includes('chrome') ? 'Chrome'
            : ua.includes('firefox') ? 'Firefox'
                : ua.includes('safari') ? 'Safari'
                    : 'Browser';

    return `${platform} - ${browser}`;
};

const getIpAddress = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded) && forwarded[0]) return forwarded[0];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '';
};

const sanitizeSettingsPayload = (payload = {}) => {
    const out = {};

    for (const section of Object.keys(SETTINGS_ALLOWED_FIELDS)) {
        const sectionPayload = payload[section];
        if (!sectionPayload || typeof sectionPayload !== 'object') continue;
        out[section] = {};
        for (const key of SETTINGS_ALLOWED_FIELDS[section]) {
            if (Object.prototype.hasOwnProperty.call(sectionPayload, key)) {
                out[section][key] = sectionPayload[key];
            }
        }
    }

    return out;
};

const ensureSettingsShape = (user) => {
    user.settings = user.settings || {};
    user.settings.profile = user.settings.profile || {};
    user.settings.preferences = user.settings.preferences || {};
    user.settings.workspace = user.settings.workspace || {};
    user.settings.security = user.settings.security || {};
    user.settings.security.sessions = user.settings.security.sessions || [];
};

const ensureProfileEmailFallback = (user) => {
    ensureSettingsShape(user);
    if (!user.settings.profile.email) {
        user.settings.profile.email = user.email || '';
    }
    if (!user.settings.profile.firstName && user.name) {
        const [firstName, ...rest] = String(user.name).split(' ');
        user.settings.profile.firstName = firstName || '';
        user.settings.profile.lastName = rest.join(' ');
    }
};

const toSettingsResponse = (user, currentSessionId = null) => ({
    profile: user.settings.profile,
    preferences: user.settings.preferences,
    workspace: user.settings.workspace,
    security: {
        sessions: (user.settings.security.sessions || []).map((s) => ({
            sessionId: s.sessionId,
            device: s.device,
            location: s.location,
            lastSeen: s.lastSeen,
            createdAt: s.createdAt,
            isCurrent: currentSessionId ? s.sessionId === currentSessionId : false
        }))
    }
});

router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        ensureSettingsShape(user);
        ensureProfileEmailFallback(user);
        await user.save();

        res.json({ settings: toSettingsResponse(user, req.sessionId || null) });
    } catch (err) {
        console.error('Error loading settings:', err);
        res.status(500).json({ message: 'Failed to load settings' });
    }
});

router.put('/me', protect, async (req, res) => {
    try {
        const updates = sanitizeSettingsPayload(req.body || {});
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        ensureSettingsShape(user);

        if (updates.profile) {
            Object.assign(user.settings.profile, updates.profile);
            const first = user.settings.profile.firstName || '';
            const last = user.settings.profile.lastName || '';
            const fullName = `${first} ${last}`.trim();
            if (fullName) user.name = fullName;
        }
        if (updates.preferences) {
            Object.assign(user.settings.preferences, updates.preferences);
            if (Array.isArray(user.settings.preferences.savedPresets)) {
                user.settings.preferences.savedPresets = user.settings.preferences.savedPresets.slice(0, 10);
            }
        }
        if (updates.workspace) Object.assign(user.settings.workspace, updates.workspace);

        if (typeof updates?.profile?.email === 'string' && updates.profile.email.trim()) {
            user.email = updates.profile.email.trim();
        }

        await user.save();

        if (global.io) {
            global.io.to(user._id.toString()).emit('settings_updated', {
                settings: toSettingsResponse(user, req.sessionId || null),
                updatedAt: new Date().toISOString()
            });
        }

        res.json({
            message: 'Settings updated successfully',
            settings: toSettingsResponse(user, req.sessionId || null),
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatarDataUrl: user.settings?.profile?.avatarDataUrl || ''
            }
        });
    } catch (err) {
        console.error('Error saving settings:', err);
        if (err?.code === 11000) {
            return res.status(400).json({ message: 'Email already in use by another account' });
        }
        res.status(500).json({ message: 'Failed to save settings' });
    }
});

router.put('/me/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body || {};

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'All password fields are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Confirm password does not match' });
        }

        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ message: 'Failed to update password' });
    }
});

router.post('/me/reset-password', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        ensureSettingsShape(user);

        user.settings.security.passwordResetRequestedAt = new Date();
        await user.save();

        res.json({ message: 'Password reset request recorded' });
    } catch (err) {
        console.error('Error requesting password reset:', err);
        res.status(500).json({ message: 'Failed to request password reset' });
    }
});

router.delete('/me/sessions/:sessionId', protect, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        ensureSettingsShape(user);

        user.settings.security.sessions = (user.settings.security.sessions || []).filter((s) => s.sessionId !== sessionId);
        await user.save();

        res.json({
            message: 'Session removed successfully',
            settings: toSettingsResponse(user, req.sessionId || null)
        });
    } catch (err) {
        console.error('Error removing session:', err);
        res.status(500).json({ message: 'Failed to remove session' });
    }
});

router.post('/me/preferences/presets', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        ensureSettingsShape(user);

        const name = String(req.body?.name || '').trim() || `Preset ${new Date().toLocaleString('en-IN')}`;
        const incoming = req.body?.preferences && typeof req.body.preferences === 'object' ? req.body.preferences : {};
        const pref = user.settings.preferences || {};
        const preset = {
            name,
            defaultCurrency: incoming.defaultCurrency || pref.defaultCurrency || 'INR',
            defaultLanding: incoming.defaultLanding || pref.defaultLanding || 'Dashboard',
            dateFormat: incoming.dateFormat || pref.dateFormat || 'DD/MM/YYYY',
            numberFormat: incoming.numberFormat || pref.numberFormat || 'Indian',
            createdAt: new Date()
        };
        user.settings.preferences.savedPresets = user.settings.preferences.savedPresets || [];
        user.settings.preferences.savedPresets.unshift(preset);
        user.settings.preferences.savedPresets = user.settings.preferences.savedPresets.slice(0, 10);
        await user.save();

        res.json({
            message: 'Preference preset saved',
            settings: toSettingsResponse(user, req.sessionId || null)
        });
    } catch (err) {
        console.error('Error saving preference preset:', err);
        res.status(500).json({ message: 'Failed to save preset' });
    }
});

router.post('/me/sync-locale', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        ensureSettingsShape(user);
        user.settings.workspace.lastLocaleSyncAt = new Date();
        await user.save();

        if (global.io) {
            global.io.to(user._id.toString()).emit('settings_updated', {
                settings: toSettingsResponse(user, req.sessionId || null),
                updatedAt: new Date().toISOString()
            });
        }

        res.json({
            message: 'Locale sync timestamp updated',
            settings: toSettingsResponse(user, req.sessionId || null)
        });
    } catch (err) {
        console.error('Error syncing locale:', err);
        res.status(500).json({ message: 'Failed to sync locale' });
    }
});

router.get('/me/export-profile-card', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        ensureSettingsShape(user);

        const payload = {
            exportedAt: new Date().toISOString(),
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            profile: user.settings.profile
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="profile-card-${user._id}.json"`);
        res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (err) {
        console.error('Error exporting profile card:', err);
        res.status(500).json({ message: 'Failed to export profile card' });
    }
});

const upsertLoginSession = async ({ userId, sessionId, req }) => {
    const user = await User.findById(userId);
    if (!user) return;
    ensureSettingsShape(user);

    const now = new Date();
    const ipAddress = getIpAddress(req);
    const userAgent = req.headers['user-agent'] || '';
    const existing = user.settings.security.sessions.find((s) => s.sessionId === sessionId);
    const sessionData = {
        sessionId,
        device: getDeviceName(userAgent),
        location: ipAddress || 'Unknown',
        userAgent,
        ipAddress,
        lastSeen: now
    };

    if (existing) {
        Object.assign(existing, sessionData);
    } else {
        user.settings.security.sessions.unshift({ ...sessionData, createdAt: now });
    }

    user.settings.security.sessions = user.settings.security.sessions.slice(0, 20);
    ensureProfileEmailFallback(user);
    await user.save();
};

module.exports = { router, upsertLoginSession };

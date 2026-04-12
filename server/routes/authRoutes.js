const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { upsertLoginSession } = require('./settingsRoutes');
const { protect } = require('../middleware/authMiddleware');
const { ConfidentialClientApplication } = require('@azure/msal-node');

const OAUTH_DOMAIN = '@gktech.ai';

const msalConfig = {
    auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: process.env.AZURE_TENANT_ID
            ? `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
            : 'https://login.microsoftonline.com/common',
        clientSecret: process.env.AZURE_CLIENT_SECRET
    }
};

const msalClient = new ConfidentialClientApplication(msalConfig);

const oauthRedirectUri =
    process.env.OUTLOOK_OAUTH_REDIRECT_URI ||
    process.env.GRAPH_REDIRECT_URI ||
    'http://localhost:5000/api/auth/outlook/callback';

const oauthSuccessRedirect =
    process.env.OUTLOOK_OAUTH_SUCCESS_REDIRECT ||
    process.env.GRAPH_AUTH_SUCCESS_REDIRECT ||
    'http://localhost:5173/gkterp/oauth/callback';

// @route   POST /api/auth/login
// @desc    Auth user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const sanitizedEmail = email ? email.trim().toLowerCase() : '';

    try {
        const user = await User.findOne({ email: sanitizedEmail });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const sessionId = randomUUID();
        const payload = {
            id: user._id,
            role: user.role,
            sid: sessionId
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '12h' },
            async (err, token) => {
                if (err) {
                    console.error('JWT Sign Error:', err);
                    return res.status(500).json({ message: 'Token generation failed' });
                }
                try {
                    await upsertLoginSession({ userId: user._id, sessionId, req });
                } catch (sessionErr) {
                    console.error('Failed to upsert login session, continuing login anyway:', sessionErr);
                }

                res.json({
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        avatarDataUrl: user.settings?.profile?.avatarDataUrl || ''
                    }
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/auth/outlook/login
// @desc    Redirect user to Microsoft login
// @access  Public
router.get('/outlook/login', async (_req, res) => {
    try {
        const authCodeUrl = await msalClient.getAuthCodeUrl({
            redirectUri: oauthRedirectUri,
            scopes: ['openid', 'profile', 'email', 'User.Read']
        });
        res.redirect(authCodeUrl);
    } catch (err) {
        console.error('Outlook OAuth start failed:', err?.message || err);
        res.status(500).send('OAuth start failed');
    }
});

// @route   GET /api/auth/outlook/callback
// @desc    Handle Microsoft login callback
// @access  Public
router.get('/outlook/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Missing OAuth code');
    }

    try {
        const tokenResponse = await msalClient.acquireTokenByCode({
            code,
            redirectUri: oauthRedirectUri,
            scopes: ['openid', 'profile', 'email', 'User.Read']
        });

        const accessToken = tokenResponse?.accessToken;
        if (!accessToken) {
            return res.status(401).send('OAuth token missing');
        }

        const profileResp = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!profileResp.ok) {
            const text = await profileResp.text();
            console.error('Graph profile error:', text);
            return res.status(401).send(`Failed to read profile: ${text}`);
        }

        const profile = await profileResp.json();
        const email = String(profile.mail || profile.userPrincipalName || '').toLowerCase();
        const displayName = String(profile.displayName || '').trim();

        if (!email.endsWith(OAUTH_DOMAIN)) {
            return res.status(403).send('Only @gktech.ai accounts are allowed.');
        }

        let user = await User.findOne({ email });
        if (!user) {
            // Import PendingUser model on the fly or at top, we'll require it here since it's only once
            const PendingUser = require('../models/PendingUser');
            
            const fallbackName = displayName || email.split('@')[0];
            
            // Check if already pending
            let pendingUser = await PendingUser.findOne({ email });
            if (!pendingUser) {
                await PendingUser.create({
                    name: fallbackName,
                    email
                });
            } else if (pendingUser.status !== 'pending') {
                // User was previously approved but their account was deleted — reset to pending
                pendingUser.status = 'pending';
                pendingUser.name = fallbackName; // refresh name in case it changed
                await pendingUser.save();
            }

            const redirectUrl = new URL(oauthSuccessRedirect);
            // Append error query param to intercept in React
            redirectUrl.searchParams.set('error', 'pending_admin_approval');
            return res.redirect(redirectUrl.toString());
        }

        const sessionId = randomUUID();
        const payload = {
            id: user._id,
            role: user.role,
            sid: sessionId
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '12h' },
            async (err, token) => {
                if (err) {
                    console.error('JWT Sign Error:', err);
                    return res.status(500).send('Token generation failed');
                }
                try {
                    await upsertLoginSession({ userId: user._id, sessionId, req });
                } catch (sessionErr) {
                    console.error('Failed to upsert login session:', sessionErr);
                }

                const redirectUrl = new URL(oauthSuccessRedirect);
                redirectUrl.searchParams.set('token', token);
                res.redirect(redirectUrl.toString());
            }
        );
    } catch (err) {
        console.error('Outlook OAuth callback error:', err?.message || err);
        res.status(500).send(`OAuth callback failed: ${err?.message || 'Unknown error'}`);
    }
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatarDataUrl: user.settings?.profile?.avatarDataUrl || ''
            }
        });
    } catch (err) {
        console.error('Auth me error:', err);
        res.status(500).json({ message: 'Failed to load user' });
    }
});

module.exports = router;

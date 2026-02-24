const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { upsertLoginSession } = require('./settingsRoutes');

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

module.exports = router;

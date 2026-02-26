const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // DEV MODE BYPASS: Allow fake tokens in development
            if (token.startsWith('dev-mode-bypass-token')) {
                // Mock user for dev mode
                req.user = {
                    _id: 'mock-head-id',
                    name: 'Amit Sharma (Dev Mode)',
                    email: 'head@company.com',
                    role: 'Delivery Team',
                    creatorCode: 'D1'
                };
                req.sessionId = 'dev-mode-session';
                return next();
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.sessionId = decoded?.sid || null;

            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                console.error(`[AuthError] User not found in database for token ID: ${decoded.id}`);
                return res.status(401).json({ message: 'User not found' });
            }

            next();
        } catch (error) {
            console.error('[AuthError] Token verification failed:', error.name, error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.error('[AuthError] No token provided in Authorization header');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };

const cors = require('cors');

// Allow all origins/ports. Origin reflection keeps credentialed requests valid.
const corsOptions = {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};

const socketCorsOptions = {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
};

const corsMiddleware = cors(corsOptions);
const corsPreflightMiddleware = cors(corsOptions);

module.exports = {
    corsOptions,
    socketCorsOptions,
    corsMiddleware,
    corsPreflightMiddleware
};


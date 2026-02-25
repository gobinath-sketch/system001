// Dynamically reflect any origin to allow all ports/hosts securely
const corsOptions = {
    origin: "*",
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

const socketCorsOptions = {
    origin: "*", // allow all for socket
    methods: ['GET', 'POST', 'OPTIONS']
};


module.exports = {
    corsOptions,
    socketCorsOptions,
};


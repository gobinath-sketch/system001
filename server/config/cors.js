// Dynamically reflect any origin to allow all ports/hosts securely
const corsOptions = {
    origin: "*",
    credentials: false
};

const socketCorsOptions = {
    origin: "*", // allow all for socket
};


module.exports = {
    corsOptions,
    socketCorsOptions,
};


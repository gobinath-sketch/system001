const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { corsOptions, socketCorsOptions } = require('./config/cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const path = require('path');

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

// --- DEPLOYMENT DIAGNOSTIC LOGGER ---
// This will help us see if NGINX/Apache is stripping the Authorization header before it reaches Node
// app.use((req, res, next) => {
//     // Only log API requests to keep the console clean
//     if (req.url.startsWith('/api')) {
//         const hasAuth = !!req.headers.authorization;
//         console.log(`[Diagnostic] ${req.method} ${req.url} | Auth Header Present: ${hasAuth}`);
//     }
//     next();
// });
// ------------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const dbUri = process.env.MONGO_URI;

mongoose.connect(dbUri)
    .then(() => console.log('? MongoDB Connected'))
    .catch(err => {
        console.error('? MongoDB Connection Failed');
        console.error(err.message);
    });

// Route imports
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
// const vendorRoutes = require('./routes/vendorRoutes');

const approvalRoutes = require('./routes/approvalRoutes');
const targetRoutes = require('./routes/targetRoutes');
// const documentRoutes = require('./routes/documentRoutes'); // Removed redundant system
const smeRoutes = require('./routes/smeRoutes');

const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settingsRoutes');

// Force Restart Tracker
const notificationRoutes = require('./routes/notifications');

// Route middleware
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Vendor Routes removed

app.use('/api/approvals', approvalRoutes);
app.use('/api/targets', targetRoutes);
// app.use('/api/documents', documentRoutes); // Removed redundant system
app.use('/api/smes', smeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes.router);

app.get('/', (req, res) => {
    res.send('ERP API Running');
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: socketCorsOptions
});

// Store io instance for use in routes
app.set('io', io);
global.io = io; // Expose globally for Model hooks

io.on('connection', (socket) => {
    // console.log('A user connected:', socket.id);

    socket.on('join_room', (userId) => {
        socket.join(userId);
        // console.log(`User ${userId} joined room`);
    });

    socket.on('disconnect', () => {
        // console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

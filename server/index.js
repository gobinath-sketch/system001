const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const path = require('path');

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected (Dashboard Updated)'))
    .catch(err => console.log(err));

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

const allowedSocketOrigins = (process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedSocketOrigins.length === 0) return callback(null, true);
            if (allowedSocketOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Socket origin not allowed by CORS'));
        },
        methods: ["GET", "POST"],
        credentials: true
    }
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

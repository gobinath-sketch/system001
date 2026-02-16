const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const addBusinessHead = async () => {
    try {
        // Connect to MongoDB with event listeners
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/erp_system';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Check if Business Head already exists by email
        const existingBH = await User.findOne({ email: 'businesshead@example.com' });
        if (existingBH) {
            console.log('Business Head already exists:', existingBH.email);
            await mongoose.connection.close();
            process.exit(0);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        // Create Business Head user
        const businessHead = new User({
            name: 'Business Head',
            email: 'businesshead@example.com',
            password: hashedPassword,
            role: 'Business Head',
            creatorCode: 'B1',
            reportingManager: null,
            targets: [{
                year: new Date().getFullYear(),
                period: 'Yearly',
                amount: 10000000
            }]
        });

        await businessHead.save();
        console.log('✅ Business Head user created successfully!');
        console.log('Email: businesshead@example.com');
        console.log('Password: password123');
        console.log('Creator Code: B1');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating Business Head:', error.message);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

addBusinessHead();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Notification = require('../models/Notification');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Connection Error:', err.message);
        process.exit(1);
    }
};

const migrateNotifications = async () => {
    await connectDB();

    try {
        // Update "Training details updated" notifications to target 'sales'
        // These are sent to Sales users, who expect 'sales' tab (Requirements)
        // Previously targeted 'delivery', which is hidden/orphaned for Sales users.
        const result = await Notification.updateMany(
            {
                message: { $regex: 'Training details updated', $options: 'i' },
                targetTab: 'delivery'
            },
            { $set: { targetTab: 'sales' } }
        );

        console.log(`Updated ${result.modifiedCount} "Training details updated" notifications from 'delivery' to 'sales'.`);

    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        mongoose.connection.close();
    }
};

migrateNotifications();

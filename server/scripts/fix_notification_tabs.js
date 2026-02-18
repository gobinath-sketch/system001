const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
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
        // 1. Rename 'expenses' -> 'billing' (Universal)
        const expensesResult = await Notification.updateMany(
            { targetTab: 'expenses' },
            { $set: { targetTab: 'billing' } }
        );
        console.log(`Updated ${expensesResult.modifiedCount} notifications from 'expenses' to 'billing'.`);

        // 2. Redirect 'revenue' -> 'billing' for Delivery Team (PO Uploads)
        const deliveryRoles = ['Delivery Team', 'Delivery Head', 'Delivery Manager', 'Operations Manager', 'Operations Lead'];
        const deliveryUsers = await User.find({ role: { $in: deliveryRoles } });
        const deliveryUserIds = deliveryUsers.map(u => u._id);

        console.log(`Found ${deliveryUserIds.length} Delivery Team users.`);

        const poResult = await Notification.updateMany(
            {
                recipientId: { $in: deliveryUserIds },
                targetTab: 'revenue',
                message: { $regex: 'PO uploaded', $options: 'i' }
            },
            { $set: { targetTab: 'billing' } }
        );
        console.log(`Updated ${poResult.modifiedCount} PO notifications for Delivery Team from 'revenue' to 'billing'.`);

        // 3. Just in case, update Invoice notifications for Delivery Team too?
        // Invoice logic: Delivery uploads Invoice -> Notifies Sales.
        // Sales uploads Invoice -> Notifies Delivery? (Not common, but maybe).
        // If Sales uploads invoice, uses 'revenue' tab. Delivery might need 'billing'.
        const invoiceResult = await Notification.updateMany(
            {
                recipientId: { $in: deliveryUserIds },
                targetTab: 'revenue',
                message: { $regex: 'Invoice', $options: 'i' }
            },
            { $set: { targetTab: 'billing' } }
        );
        console.log(`Updated ${invoiceResult.modifiedCount} Invoice notifications for Delivery Team from 'revenue' to 'billing'.`);


    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        mongoose.connection.close();
    }
};

migrateNotifications();

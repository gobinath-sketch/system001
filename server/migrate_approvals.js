const mongoose = require('mongoose');
const Approval = require('./models/Approval');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        const res = await Approval.updateMany(
            { triggerReason: { $exists: false } },
            { $set: { triggerReason: 'gp', contingencyPercent: 15 } }
        );
        console.log('Updated legacy Approval docs:', res);
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });

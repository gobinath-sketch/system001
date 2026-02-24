const mongoose = require('mongoose');
require('dotenv').config();
const Approval = require('./models/Approval');
const User = require('./models/User');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const a1 = await Approval.findById('699d96f5e93cebf8267f3e56');

    if (a1.rejectedBy) {
        const user = await User.findById(a1.rejectedBy);
        console.log('Rejected by:', user ? user.name : a1.rejectedBy);
    } else {
        console.log('No rejectedBy recorded');
    }
    console.log('Rejection reason:', a1.rejectionReason);
    process.exit(0);
}
test();

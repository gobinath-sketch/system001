const mongoose = require('mongoose');
require('dotenv').config();
const Approval = require('./models/Approval');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const a1 = await Approval.findById('699d96f5e93cebf8267f3e56');
    const a2 = await Approval.findById('699d96f5e93cebf8267f3e5b');
    console.log('Contingency created:', a1._id.getTimestamp());
    console.log('Contingency updated:', a1.updatedAt);
    console.log('Contingency rejected:', a1.rejectedAt);
    console.log('GP created:', a2._id.getTimestamp());
    console.log('GP updated:', a2.updatedAt);
    console.log('GP approved:', a2.approvedAt);
    process.exit(0);
}
test();

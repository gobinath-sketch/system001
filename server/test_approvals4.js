const mongoose = require('mongoose');
require('dotenv').config();
const Approval = require('./models/Approval');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    // Same opportunity ID as before. Let's get the opp ID.
    const a1 = await Approval.findById('699d96f5e93cebf8267f3e56');
    const allApprovals = await Approval.find({ opportunity: a1.opportunity });
    console.log('All Approvals for Opp:');
    console.log(allApprovals.map(a => ({
        _id: a._id.toString(),
        trigger: a.triggerReason,
        status: a.status,
        reason: a.rejectionReason,
        level: a.approvalLevel
    })));
    process.exit(0);
}
test();

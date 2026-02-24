const mongoose = require('mongoose');
require('dotenv').config();
const Opportunity = require('./models/Opportunity');
const Approval = require('./models/Approval');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find an opp with ~39k TOV or the one in the screenshot
    const opps = await Opportunity.find({ 'commonDetails.tov': { $gte: 39000, $lte: 40000 } }).limit(5);
    for (let opp of opps) {
        console.log(`Opp: ${opp.opportunityNumber}, Status: ${opp.approvalStatus}`);
        const approvals = await Approval.find({ opportunity: opp._id }).sort({ createdAt: 1 });
        console.log(approvals.map(a => ({
            _id: a._id.toString(),
            trigger: a.triggerReason,
            status: a.status,
            gp: a.gpPercent,
            con: a.contingencyPercent,
            lvl: a.approvalLevel
        })));
    }
    process.exit(0);
}

test().catch(console.error);

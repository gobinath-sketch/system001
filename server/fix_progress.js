const mongoose = require('mongoose');
const Opportunity = require('./models/Opportunity');
const { calculateOpportunityProgress } = require('./utils/progressCalculator');
// Mocking the calculate function dependency if it's not exported correctly or to ensure latest logic is used
// But wait, I just edited utils/progressCalculator.js, so I should require it.

require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB Connected');

        const opportunities = await Opportunity.find({});
        console.log(`Found ${opportunities.length} opportunities. Recalculating progress...`);

        let updatedCount = 0;

        for (const opp of opportunities) {
            // Recalculate using the UPDATED utility function
            const { progressPercentage, statusStage, statusLabel } = calculateOpportunityProgress(opp);

            if (opp.progressPercentage !== progressPercentage || opp.statusStage !== statusStage || opp.statusLabel !== statusLabel) {
                console.log(`Updating ${opp.opportunityNumber}: ${opp.progressPercentage}% -> ${progressPercentage}%`);

                opp.progressPercentage = progressPercentage;
                opp.statusStage = statusStage;
                opp.statusLabel = statusLabel;

                await opp.save();
                updatedCount++;
            }
        }

        console.log(`Process Complete. Updated ${updatedCount} opportunities.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

run();

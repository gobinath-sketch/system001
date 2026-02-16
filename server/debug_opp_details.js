const mongoose = require('mongoose');
const Opportunity = require('./models/Opportunity');
const Client = require('./models/Client'); // Required for reference
const User = require('./models/User'); // Required for reference
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB Connected');

        const opp = await Opportunity.findOne({ opportunityNumber: 'GKT26VI01006' });

        if (!opp) {
            console.log('Opportunity not found');
            return;
        }

        console.log('--- Debugging GKT26VI01006 ---');
        console.log('Type:', opp.type);
        console.log('Participants:', opp.participants);
        console.log('Requirement Summary:', opp.requirementSummary);
        console.log('Type Specific Details:', JSON.stringify(opp.typeSpecificDetails, null, 2));

        // Manual Progress Check logic duplication for debugging
        const typeDetails = opp.typeSpecificDetails || {};
        const type = opp.type || 'Training';
        let hasScope = false;
        let hasSizing = false;

        console.log('\n--- Logic Check ---');

        if (type === 'Training') {
            const tech = typeDetails.technology;
            const mode = typeDetails.modeOfTraining;
            const name = typeDetails.trainingName || opp.commonDetails?.courseName;

            console.log(`Training Check:
             - Technology: ${tech} (${!!tech})
             - Mode: ${mode} (${!!mode})
             - Name: ${name} (${!!name})
             `);

            hasScope = (tech && mode && name);
            hasSizing = (opp.participants > 0);
            console.log(`Has Scope: ${hasScope}`);
            console.log(`Has Sizing: ${hasSizing} (Participants: ${opp.participants})`);
        } else if (type === 'Virtual') {
            // Sometimes 'Virtual' is stored as type if schema changed? Checking common confusion
            console.log('Type is Virtual? Should be Training with Mode=Virtual');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

run();

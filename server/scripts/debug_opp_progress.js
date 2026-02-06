const mongoose = require('mongoose');
const Opportunity = require('../models/Opportunity');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { calculateOpportunityProgress } = require('../utils/progressCalculator');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db');
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

const checkOpportunity = async () => {
    await connectDB();
    const oppNumber = "GKT26VI01011";

    try {
        const opp = await Opportunity.findOne({ opportunityNumber: oppNumber });

        if (!opp) {
            console.log(`Opportunity ${oppNumber} not found.`);
            return;
        }

        console.log(`\n=== Opportunity ${oppNumber} Data ===`);
        console.log(`Current Progress: ${opp.progressPercentage}%`);

        console.log('\n--- Status Check for > 80% ---');

        // 80% Check (PO)
        console.log(`PO Document: ${opp.poDocument ? '✅ Present' : '❌ Missing'}`);

        // 90% Check (Invoice)
        console.log(`Invoice Document: ${opp.invoiceDocument ? '✅ Present' : '❌ Missing'}`);

        // 100% Check (Delivery Docs)
        const docs = opp.deliveryDocuments || {};
        const allDocs = ['attendance', 'feedback', 'assessment', 'performance'];

        console.log('\n--- Delivery Documents (Required for 100%) ---');
        allDocs.forEach(doc => {
            console.log(`${doc.charAt(0).toUpperCase() + doc.slice(1)}: ${docs[doc] ? '✅ Present' : '❌ Missing'}`);
        });

        console.log('\n--- Calculation Result (Dry Run) ---');
        const result = calculateOpportunityProgress(opp);
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
};

checkOpportunity();

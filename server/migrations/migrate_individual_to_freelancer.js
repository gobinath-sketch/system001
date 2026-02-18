const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const SME = require('../models/SME');
const Vendor = require('../models/Vendor');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const smes = await SME.find({});
        console.log(`Found ${smes.length} SMEs to process`);

        let companyCount = 0;
        let freelancerCount = 0;
        let updatedCount = 0;

        for (const sme of smes) {
            let updated = false;

            // Determine Type based on companyVendor existence
            if (sme.companyVendor) {
                // It's a company
                if (sme.smeType !== 'Company') {
                    sme.smeType = 'Company';
                    updated = true;
                }

                // Populate Company fields if missing
                if (!sme.companyName || !sme.companyContactNumber || !sme.companyAddress) {
                    try {
                        const vendor = await Vendor.findById(sme.companyVendor);
                        if (vendor) {
                            if (!sme.companyName) {
                                sme.companyName = vendor.displayName || vendor.name;
                                updated = true;
                            }
                            if (!sme.companyContactNumber) {
                                sme.companyContactNumber = vendor.contactNumber || 'N/A';
                                updated = true;
                            }
                            if (!sme.companyAddress) {
                                sme.companyAddress = vendor.address || 'N/A';
                                updated = true;
                            }
                        } else {
                            console.warn(`Warning: Vendor ${sme.companyVendor} not found for SME ${sme._id}`);
                            if (!sme.companyName) sme.companyName = 'Unknown Company';
                            updated = true;
                        }
                    } catch (err) {
                        console.error(`Error finding vendor for SME ${sme._id}:`, err);
                    }
                }
                companyCount++;
            } else {
                // It's a freelancer
                if (sme.smeType !== 'Freelancer') {
                    sme.smeType = 'Freelancer';
                    updated = true;
                }
                freelancerCount++;
            }

            // Ensure required fields have valid defaults to satisfy schema (though we use validateBeforeSave: false, it helps consistency)
            if (!sme.yearsExperience) sme.yearsExperience = 0;

            // Tax and bank details defaults if missing
            if (!sme.gstNo) sme.gstNo = 'Pending';
            if (!sme.gstDocument) sme.gstDocument = 'Pending';
            if (!sme.panNo) sme.panNo = 'Pending';
            if (!sme.panDocument) sme.panDocument = 'Pending';
            if (!sme.sowDocument) sme.sowDocument = 'Pending';
            if (!sme.ndaDocument) sme.ndaDocument = 'Pending';
            if (!sme.contentUpload) sme.contentUpload = 'Pending';

            updated = true; // Force save to apply defaults and type

            if (updated) {
                // Using validateBeforeSave: false to ensure migration succeeds even if some legacy data is incomplete
                await sme.save({ validateBeforeSave: false });
                updatedCount++;
            }
        }

        console.log(`Migration Complete.`);
        console.log(`Processed: ${smes.length}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Companies: ${companyCount}`);
        console.log(`Freelancers: ${freelancerCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();

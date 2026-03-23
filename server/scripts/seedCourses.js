const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const Course = require('../models/Course');

async function seed() {
    try {
        console.log('Connecting to DB:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const filePath = path.join(__dirname, '..', 'data', 'gkt_courses.xlsx');
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let count = 0;
        let errors = 0;
        for (const row of data) {
            const courseCode = row['Course Code']?.toString().trim();
            const courseName = row['Course Name']?.toString().trim();
            const technology = row['Technology']?.toString().trim();
            const durationStr = row['Duration']?.toString().trim() || '';

            if (!courseCode || !courseName || !technology) {
                continue;
            }

            let durationHours = null;
            if (durationStr) {
                const num = parseFloat(durationStr);
                if (!isNaN(num)) {
                    if (durationStr.toLowerCase().includes('day')) {
                        durationHours = num * 8;
                    } else {
                        durationHours = num; // Assume hours
                    }
                }
            }

            try {
                await Course.findOneAndUpdate(
                    { courseCode, courseName },
                    { technology, durationHours, updatedAt: Date.now() },
                    { upsert: true, new: true }
                );
                count++;
            } catch (err) {
                errors++;
            }
        }
        console.log(`Successfully upserted ${count} courses. ${errors} errors.`);
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();

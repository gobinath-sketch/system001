const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

const seedUsers = async () => {
    try {
        await User.deleteMany({}); // Clear existing users

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        // 1. Create Director
        const director = new User({
            name: 'Amit Sharma',
            email: 'amit.director@company.com',
            password: hashedPassword,
            role: 'Director',
            creatorCode: 'B1'
        });
        await director.save();
        console.log('Director created');

        // 2. Create Sales Managers
        const manager1 = new User({
            name: 'Priya Singh',
            email: 'priya.mgr@company.com',
            password: hashedPassword,
            role: 'Sales Manager',
            creatorCode: 'M1',
            reportingManager: director._id
        });

        const manager2 = new User({
            name: 'Rahul Verma',
            email: 'rahul.mgr@company.com',
            password: hashedPassword,
            role: 'Sales Manager',
            creatorCode: 'M2',
            reportingManager: director._id
        });

        await manager1.save();
        await manager2.save();
        console.log('Sales Managers created');

        // 3. Create Sales Executives
        const executives = [
            { name: 'Vikram Das', email: 'vikram.exec@company.com', manager: manager1._id, code: 'E1' },
            { name: 'Sneha Patel', email: 'sneha.exec@company.com', manager: manager1._id, code: 'E2' },
            { name: 'Arjun Reddy', email: 'arjun.exec@company.com', manager: manager2._id, code: 'E3' },
            { name: 'Neha Gupta', email: 'neha.exec@company.com', manager: manager2._id, code: 'E4' }
        ];

        for (const exec of executives) {
            await new User({
                name: exec.name,
                email: exec.email,
                password: hashedPassword,
                role: 'Sales Executive',
                creatorCode: exec.code,
                reportingManager: exec.manager
            }).save();
        }
        console.log('Sales Executives created');

        // 4. Create Delivery Team User
        const deliveryUser = new User({
            name: 'Operations Lead',
            email: 'ops.lead@company.com',
            password: hashedPassword,
            role: 'Delivery Team',
            creatorCode: 'D1',
            reportingManager: director._id // Reporting to Director
        });
        await deliveryUser.save();
        console.log('Delivery Team created');

        // 5. Create Finance User
        const financeUser = new User({
            name: 'Finance Manager',
            email: 'finance@company.com',
            password: hashedPassword,
            role: 'Finance',
            creatorCode: 'F1',
            reportingManager: director._id // Reporting to Director
        });
        await financeUser.save();
        console.log('Finance User created');

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedUsers();

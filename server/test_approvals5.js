const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ name: 'Priya Singh' });
    console.log('Role:', user.role);
    process.exit(0);
}
test();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const PEOPLE = [
  {
    department: 'Sales',
    name: 'Vinitha M',
    designation: 'Regional Manager',
    email: 'Vinitha.M@gktech.ai',
    reportingManager: 'Dinesh T',
    accessToBeGiven: 'Sales Executive'
  },
  {
    department: 'Sales',
    name: 'Dinesh T',
    designation: 'CTO',
    email: 'Dinesh.T@globalknowledgetech.com',
    reportingManager: 'Senthil Kumar S / Lakshmi S',
    accessToBeGiven: 'Sales Manager'
  },
  {
    department: 'Sales',
    name: 'Chetana PN',
    designation: 'Business Head',
    email: 'chetana.n@gktech.ai',
    reportingManager: 'Senthil Kumar S / Lakshmi S',
    accessToBeGiven: 'Business Head'
  },
  {
    department: 'Sales',
    name: 'Tishita Pal',
    designation: 'Business Development Executive',
    email: 'Tishita.Pal@gktech.ai',
    reportingManager: 'Indupriyadarshini V',
    accessToBeGiven: 'Sales Executive'
  },
  {
    department: 'Sales',
    name: 'Mathumitha S',
    designation: 'Business Development Executive',
    email: 'Mathumitha.S@gktech.ai',
    reportingManager: 'Indupriyadarshini V',
    accessToBeGiven: 'Sales Executive'
  },
  {
    department: 'Sales',
    name: 'Indupriyadarshini V',
    designation: 'HR Manager',
    email: 'Indu.V@gktech.ai',
    reportingManager: 'Chetana PN',
    accessToBeGiven: 'Sales Manager'
  },
  {
    department: 'delivery',
    name: 'Lakshmi Prasanna',
    designation: 'Delivery & Operations Head',
    email: 'lakshmi.p@gktech.ai',
    reportingManager: 'Senthil Kumar S / Lakshmi S',
    accessToBeGiven: 'Delivery Team'
  }
];

const ROLE_BY_ACCESS = {
  'Sales Executive': 'Sales Executive',
  'Sales Manager': 'Sales Manager',
  'Business Head': 'Business Head',
  'Delivery Team': 'Delivery Team'
};

const normalizeName = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const splitManagerCandidates = (value = '') =>
  String(value)
    .split(/[\/,\n]+/)
    .map((v) => v.trim())
    .filter(Boolean);

const buildCreatorCode = (role, index) => {
  if (role === 'Business Head') return `B${index}`;
  if (role === 'Sales Manager') return `M${index}`;
  if (role === 'Delivery Team') return `D${index}`;
  return `E${index}`;
};

const seedFromSheet = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const allUsers = await User.find({}).select('_id name email creatorCode role');

  // Find maximum existing creator code numbers
  const maxCounters = { 'B': 0, 'M': 0, 'E': 0, 'D': 0 };
  allUsers.forEach(u => {
    if (u.creatorCode) {
      const prefix = u.creatorCode.charAt(0);
      const num = parseInt(u.creatorCode.substring(1), 10);
      if (!isNaN(num) && maxCounters[prefix] !== undefined) {
        if (num > maxCounters[prefix]) maxCounters[prefix] = num;
      }
    }
  });

  const counters = {
    'Business Head': maxCounters['B'] + 1,
    'Sales Manager': maxCounters['M'] + 1,
    'Sales Executive': maxCounters['E'] + 1,
    'Delivery Team': maxCounters['D'] + 1
  };

  const byName = new Map(allUsers.map((u) => [normalizeName(u.name), u]));
  const createdOrUpdated = [];

  for (const person of PEOPLE) {
    const email = String(person.email || '').trim().toLowerCase();
    const role = ROLE_BY_ACCESS[person.accessToBeGiven] || 'Sales Executive';

    let user = await User.findOne({ email });
    if (!user) {
      const creatorCode = buildCreatorCode(role, counters[role]++);
      user = new User({
        name: person.name,
        email,
        password: hashedPassword,
        role,
        creatorCode
      });
    } else {
      user.name = person.name;
      user.role = role;
      user.password = hashedPassword; // Overwrite old passwords
      if (!user.creatorCode) {
        user.creatorCode = buildCreatorCode(role, counters[role]++);
      }
    }

    // Keep the source designation/department inside profile settings for reference.
    user.settings = user.settings || {};
    user.settings.profile = user.settings.profile || {};
    user.settings.profile.designation = person.designation;
    user.settings.profile.department = person.department;

    await user.save();
    createdOrUpdated.push(user);
    byName.set(normalizeName(user.name), user);
  }

  for (const person of PEOPLE) {
    const email = String(person.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) continue;

    const managerCandidates = splitManagerCandidates(person.reportingManager);
    let manager = null;
    for (const candidate of managerCandidates) {
      const match = byName.get(normalizeName(candidate));
      if (match) {
        manager = match;
        break;
      }
    }

    if (manager) {
      user.reportingManager = manager._id;
      await user.save();
    } else if (managerCandidates.length > 0) {
      console.log(
        `Skipped manager link for "${person.name}" (manager not found in DB/sheet): ${person.reportingManager}`
      );
    }
  }

  console.log(`Seed complete. Upserted ${createdOrUpdated.length} users from sheet data.`);
  await mongoose.disconnect();
};

seedFromSheet().catch((err) => {
  console.error(err);
  process.exit(1);
});

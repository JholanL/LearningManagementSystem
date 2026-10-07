// Creates the first admin account. Run from server/: npm run seed:admin
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const run = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first');
    process.exit(1);
  }

  await connectDB();

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`Nothing created. ${email} already exists with role "${existing.role}".`);
  } else {
    await User.create({
      name: ADMIN_NAME || 'Administrator',
      email,
      password: ADMIN_PASSWORD,
      role: 'admin',
    });
    console.log(`Admin account created: ${email}`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});

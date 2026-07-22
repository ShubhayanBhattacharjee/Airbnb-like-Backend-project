import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';

await mongoose.connect(process.env.MONGODB_URI);

// Super admin — full access, including delete/payout/commission actions
const superPassword = await bcrypt.hash('SuperAdmin@1234', 12);
const superAdmin = await User.findOneAndUpdate(
    { email: 'admin@homestays.com' },
    {
        fname: 'Super', lname: 'Admin',
        email: 'admin@homestays.com',
        password: superPassword,
        role: 'admin',
        adminRole: 'super_admin',
        isVerified: true
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
);
console.log('Super admin ready:', superAdmin.email, '-', superAdmin.adminRole);

// Support admin — can moderate (ban/flag/hide) but not delete or touch money
const supportPassword = await bcrypt.hash('Support@1234', 12);
const supportAdmin = await User.findOneAndUpdate(
    { email: 'support@homestays.com' },
    {
        fname: 'Support', lname: 'Admin',
        email: 'support@homestays.com',
        password: supportPassword,
        role: 'admin',
        adminRole: 'support',
        isVerified: true
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
);
console.log('Support admin ready:', supportAdmin.email, '-', supportAdmin.adminRole);

await mongoose.disconnect();
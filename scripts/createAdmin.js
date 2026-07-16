import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';

await mongoose.connect(process.env.MONGODB_URI);
const password = await bcrypt.hash('Admin@1234', 12);
await User.create({
    fname: 'Super', lname: 'Admin',
    email: 'admin@homestays.com',
    password,
    role: 'admin',
    isVerified: true
});
console.log('Admin created');
await mongoose.disconnect();
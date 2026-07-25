import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';
import User from '../models/user.js';
import { ensureHostId } from '../utils/sequence.js';

await mongoose.connect(process.env.MONGODB_URI);

const hosts = await User.find({ role: 'host', hostId: { $exists: false } })
    .sort({ _id: 1 }); 
let assigned = 0;
for (const host of hosts) {
    await ensureHostId(host);
    await host.save();
    console.log(`${host.email} -> ${host.hostId}`);
    assigned++;
}

console.log(`Done. Assigned host IDs to ${assigned} host(s).`);
await mongoose.disconnect();

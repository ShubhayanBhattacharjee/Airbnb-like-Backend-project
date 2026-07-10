import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Home from '../models/home.js';

await mongoose.connect(process.env.MONGODB_URI);

const homes = await Home.find({ photo: { $exists: true } });
let updated = 0;

for (const home of homes) {
    if (!home.photos || home.photos.length === 0) {
        home.photos = [home.photo];
        await home.save();
        updated++;
    }
}

console.log(`Migrated ${updated} home(s) from 'photo' to 'photos'.`);
await mongoose.disconnect();
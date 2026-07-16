import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';
import Home from '../models/home.js';
import { geocodeAddress } from '../utils/geocode.js';

await mongoose.connect(process.env.MONGODB_URI);

const homes = await Home.find({ lat: { $exists: false } });
console.log(`Found ${homes.length} listing(s) without coordinates.`);

let updated = 0;
for (const home of homes) {
    const coords = await geocodeAddress(home.location);
    if (coords) {
        home.lat = coords.lat;
        home.lng = coords.lng;
        await home.save();
        updated++;
        console.log(`  ✓ ${home.houseName} (${home.location}) -> ${coords.lat}, ${coords.lng}`);
    } else {
        console.log(`  ✗ ${home.houseName} (${home.location}) -> could not geocode, skipped`);
    }
    await new Promise(resolve => setTimeout(resolve, 1100));
}

console.log(`Done. Geocoded ${updated}/${homes.length} listings.`);
await mongoose.disconnect();
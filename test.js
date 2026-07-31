import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected successfully");
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

main();
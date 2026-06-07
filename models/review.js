import { mongoose } from "mongoose";

const reviewSchema = new mongoose.Schema({
    home: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Home",
        required: true,
        index: true
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
        unique: true  
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 1000
    },
    hostReply: {
        comment: { type: String, trim: true, maxlength: 1000 },
        repliedAt: { type: Date }
    }
}, { timestamps: true });

export default mongoose.model("Review", reviewSchema);
import { mongoose } from "mongoose";

const bookingSchema = new mongoose.Schema({
    home: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Home",
        required: true
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true },
    nights: { type: Number, required: true },
    status: {
        type: String,
        enum: ["upcoming", "completed", "cancelled"],
        default: "upcoming"
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },
    razorpayRefundId:{ type: String },
    refundStatus: {
        type: String,
        enum: ["none", "initiated", "failed"],
        default: "none"
    },
    hasReviewed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Booking", bookingSchema);
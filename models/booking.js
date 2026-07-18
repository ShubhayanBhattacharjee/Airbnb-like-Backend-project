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
    hasReviewed: { type: Boolean, default: false },
    platformCommissionPercent: { type: Number, default: 10 }, // % kept by the company
    platformCommission:        { type: Number, default: 0 },  // amount kept by company
    payoutAmount:               { type: Number, default: 0 }, // amount owed to host (after commission)
    payoutStatus: {
        type: String,
        enum: ["not_applicable", "pending", "paid", "failed"],
        default: "not_applicable"
    },
    payoutMethod:    { type: String, default: "" },   // "UPI" or "Bank Transfer"
    payoutReference: { type: String, default: "" },   // UTR / transaction id / admin note
    payoutDate:      { type: Date },
    payoutDueDate:   { type: Date } // checkout + 3 days — host must be paid out by this date
}, { timestamps: true });

export default mongoose.model("Booking", bookingSchema);
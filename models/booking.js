import { mongoose } from "mongoose";

const bookingSchema = new mongoose.Schema({
    bookingId: { type: String, unique: true },   
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
        enum: ["none", "initiated", "processed", "failed", "not_applicable", "awaiting_host_repayment"],
        default: "none"
    },
    refundAmount:  { type: Number, default: 0 }, // actual ₹ refunded to guest
    refundPercent: { type: Number, default: 0 }, // % of totalPrice refunded, per cancellation policy

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
    payoutDueDate:   { type: Date } ,// checkout + 3 days — host must be paid out by this date
    originalCheckIn:   { type: Date },  // set once, on the first modification — preserves what was originally booked
    originalCheckOut:  { type: Date },
    modificationCount: { type: Number, default: 0 },
    lastModifiedAt:    { type: Date },
    cancelledBy: { type: String, enum: ["guest", "host", "admin", "system"] },
    hostCancelNote: { type: String, default: "" },
    hostRepaymentStatus: {
        type: String,
        enum: ["not_applicable", "pending", "paid", "overdue"],
        default: "not_applicable"
    },
    hostRepaymentAmount:      { type: Number, default: 0 },  // what the host owes back
    hostRepaymentDueAt:       { type: Date },                 // 24h deadline
    hostRepaymentReference:   { type: String, default: "" },  // admin fills on confirm
    hostRepaymentMarkedSentAt:{ type: Date },                 // host self-reports "I sent it"
    hostRepaymentConfirmedAt: { type: Date },                 // admin confirms receipt
}, { timestamps: true });
bookingSchema.index({ home: 1, paymentStatus: 1 });
bookingSchema.index({ home: 1, status: 1 });
bookingSchema.index({ home: 1, payoutStatus: 1 });
bookingSchema.index({ checkIn: 1 });
bookingSchema.index(
    { razorpayOrderId: 1 },
    { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } }
);
export default mongoose.model("Booking", bookingSchema);
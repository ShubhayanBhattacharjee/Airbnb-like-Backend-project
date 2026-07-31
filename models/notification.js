import { mongoose } from "mongoose";

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            "booking_confirmed",
            "payment_updated",
            "booking_modified",
            "booking_cancelled",
            "favourite_added",
            "favourite_removed",
            "profile_updated",
            "host_new_booking",
            "host_booking_cancelled",
            "host_booking_modified",
            "host_home_added",
            "host_home_updated",
            "host_dates_blocked",
            "host_dates_unblocked",
            "host_payout_paid",
            "host_payout_failed",
            "security_updated",
            "issue_status_updated",
            "issue_resolved",
            "general"
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true, default: "" },
    link: { type: String, default: "" },
    icon: { type: String, default: "" }, // logical icon key used by the frontend
    isRead: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
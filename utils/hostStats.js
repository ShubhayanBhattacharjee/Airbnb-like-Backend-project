import Booking from "../models/booking.js";
import Inquiry from "../models/inquiry.js";
import User from "../models/user.js";

const RESPONSE_WINDOW_DAYS = 90;   // rolling window, so an old bad month doesn't haunt a host forever
const RELIABILITY_WINDOW_COUNT = 100; // last N confirmed bookings

export const recomputeHostStats = async (hostId) => {
    const since = new Date(Date.now() - RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // --- Reliability / acceptance-rate stand-in ---
    const homeIds = (await (await import("../models/home.js")).default
        .find({ owner: hostId }).select("_id")).map(h => h._id);

    const recentBookings = await Booking.find({
        home: { $in: homeIds },
        paymentStatus: "paid"
    }).sort({ createdAt: -1 }).limit(RELIABILITY_WINDOW_COUNT).select("cancelledBy");

    let acceptanceRatePercent = null;
    if (recentBookings.length >= 5) { // don't show a % off a tiny sample
        const hostCancelled = recentBookings.filter(b => b.cancelledBy === "host").length;
        acceptanceRatePercent = Math.round(((recentBookings.length - hostCancelled) / recentBookings.length) * 1000) / 10;
    }

    // --- Response rate / time ---
    const inquiries = await Inquiry.find({
        host: hostId,
        createdAt: { $gte: since }
    }).select("createdAt reply status");

    let responseRatePercent = null;
    let avgResponseTimeMinutes = null;
    if (inquiries.length >= 3) {
        const answered = inquiries.filter(i => i.status === "answered");
        responseRatePercent = Math.round((answered.length / inquiries.length) * 1000) / 10;
        if (answered.length > 0) {
            const totalMinutes = answered.reduce((sum, i) => {
                return sum + (new Date(i.reply.repliedAt) - new Date(i.createdAt)) / 60000;
            }, 0);
            avgResponseTimeMinutes = Math.round(totalMinutes / answered.length);
        }
    }

    await User.findByIdAndUpdate(hostId, {
        hostStats: {
            acceptanceRatePercent,
            responseRatePercent,
            avgResponseTimeMinutes,
            totalInquiries: inquiries.length,
            totalBookingsConsidered: recentBookings.length,
            statsUpdatedAt: new Date()
        }
    });
};

// human-readable helper for templates
export const formatResponseTime = (minutes) => {
    if (minutes == null) return null;
    if (minutes < 60) return "within an hour";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `within ${hours} hour${hours > 1 ? "s" : ""}`;
    const days = Math.round(hours / 24);
    return `within ${days} day${days > 1 ? "s" : ""}`;
};
import Booking from "../models/booking.js";
import { sendEmail } from "./sendEmail.js";
import { hostPayoutSentTemplate } from "./emailTemplates.js";
import { logAudit } from "./auditLog.js";

export const runAutoPayouts = async () => {
    const dueBookingIds = await Booking.find({
        status: { $in: ["completed", "cancelled"] },
        payoutStatus: "pending",
        payoutDueDate: { $lte: new Date() }
    }).distinct("_id");
    let paid = 0;
    let skipped = 0;
    for (const bookingId of dueBookingIds) {
        const booking = await Booking.findById(bookingId).populate({
            path: "home",
            populate: { path: "owner" }
        });
        if (!booking) continue;
        const home = booking.home;
        const host = home && home.owner;
        if (!host || !host.payoutDetails || !host.payoutDetails.method) {
            skipped++;
            continue;
        }
        const payoutMethod = host.payoutDetails.method === "upi" ? "UPI" : "Bank Transfer";
        const payoutReference = `AUTO-${booking._id.toString().slice(-8).toUpperCase()}`;
        const payoutDate = new Date();
        const claimed = await Booking.findOneAndUpdate(
            { _id: booking._id, payoutStatus: "pending" },
            { $set: { payoutStatus: "paid", payoutMethod, payoutReference, payoutDate } },
            { new: true }
        );
        if (!claimed) {
            skipped++;
            continue;
        }
        paid++;
        await logAudit({
            actorType: "system", actorId: null,
            action: "payout_auto_paid", targetType: "Booking", targetId: claimed._id,
            details: `₹${claimed.payoutAmount} via ${payoutMethod}, ref: ${payoutReference}`
        });
        try {
            await sendEmail(
                host.email,
                "Your payout has been sent — HomeStays",
                hostPayoutSentTemplate(host.fname, claimed, home)
            );
        } catch (emailErr) {
            console.error("Payout email failed:", emailErr.message);
        }
    }
    return { paid, skipped, checked: dueBookingIds.length };
};
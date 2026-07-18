import Booking from "../models/booking.js";
import { sendEmail } from "./sendEmail.js";
import { hostPayoutSentTemplate } from "./emailTemplates.js";
export const runAutoPayouts = async () => {
    const duePayouts = await Booking.find({
        paymentStatus: "paid",
        payoutStatus: "pending",
        payoutDueDate: { $lte: new Date() }
    }).populate({ path: "home", populate: { path: "owner" } });

    let paid = 0;
    let skipped = 0;

    for (const booking of duePayouts) {
        const home = booking.home;
        const host = home && home.owner;
        if (!host || !host.payoutDetails || !host.payoutDetails.method) {
            skipped++;
            continue;
        }
        booking.payoutStatus = "paid";
        booking.payoutMethod = host.payoutDetails.method === "upi" ? "UPI" : "Bank Transfer";
        booking.payoutReference = `AUTO-${booking._id.toString().slice(-8).toUpperCase()}`;
        booking.payoutDate = new Date();
        await booking.save();
        paid++;
        try {
            await sendEmail(
                host.email,
                "Your payout has been sent — HomeStays",
                hostPayoutSentTemplate(host.fname, booking, home)
            );
        } catch (emailErr) {
            console.error("Payout email failed:", emailErr.message);
        }
    }
    return { paid, skipped, checked: duePayouts.length };
};
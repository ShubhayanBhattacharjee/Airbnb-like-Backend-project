import Razorpay from "razorpay";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Home from "../models/home.js";
import { sendEmail } from "../utils/sendEmail.js";
import {
    bookingConfirmedTemplate,
    hostNewBookingTemplate,
    bookingCancelledGuestTemplate,
    hostBookingCancelledTemplate,
    hostBookingModifiedTemplate,
    hostCancelledGuestTemplate
} from "../utils/emailTemplates.js";
import { getTotalPriceForRange } from "../utils/pricing.js";
import { getRefundPercent } from "../utils/cancellationPolicy.js";
import { logAudit } from "../utils/auditLog.js";
import { getCommissionPercent } from "../utils/commission.js";
import { notify } from "../utils/notify.js";
import { getNextSequence, formatBookingId } from "../utils/sequence.js";
import { recomputeHostStats } from "../utils/hostStats.js";

export const getRazorpay = () => new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const isAvailable = async (homeId, checkIn, checkOut, excludeBookingId = null) => {
    const home = await Home.findById(homeId);
    if (!home) return false;
    const blockedConflict = home.blockedDates.some(b =>
        checkIn < b.to && checkOut > b.from
    );
    if (blockedConflict) return false;
    const conflictQuery = {
        home: homeId,
        status: { $ne: "cancelled" },
        paymentStatus: "paid",
        $or: [
            { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }
        ]
    };
    if (excludeBookingId) conflictQuery._id = { $ne: excludeBookingId };
    const bookingConflict = await Booking.findOne(conflictQuery);
    return !bookingConflict;
};

export const checkAvailability = async (req, res) => {
    try {
        const { homeId, checkIn, checkOut } = req.query;
        if (!homeId || !checkIn || !checkOut) {
            return res.json({ available: false, message: "Missing fields" });
        }
        const inDate  = new Date(checkIn);
        const outDate = new Date(checkOut);

        if (isNaN(inDate) || isNaN(outDate) || outDate <= inDate) {
            return res.json({ available: false, message: "Invalid dates" });
        }
        const available = await isAvailable(homeId, inDate, outDate);
        const nights = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
        const home   = await Home.findById(homeId);
        const total  = getTotalPriceForRange(home, inDate, outDate);   // was: nights * home.price
        res.json({ available, nights, totalPrice: total, pricePerNight: home.price });
    } catch (err) {
        console.error(err);
        res.status(500).json({ available: false, message: "Server error" });
    }
};

export const createOrder = async (req, res) => {
    try {
        const { homeId, checkIn, checkOut, guests } = req.body;
        const inDate  = new Date(checkIn);
        const outDate = new Date(checkOut);
        const home   = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({ error: "This home no longer exists" });
        }
        if (home.owner.toString() === req.user._id.toString()) {
            return res.status(403).json({ error: "You can't book your own listing" });
        }
        const available = await isAvailable(homeId, inDate, outDate);
        if (!available) {
            return res.status(409).json({ error: "Dates no longer available" });
        }
        const nights = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
        const total  = getTotalPriceForRange(home, inDate, outDate);
        const order = await getRazorpay().orders.create({
            amount: total * 100,
            currency: "INR",
            receipt: `booking_${Date.now()}`,
            notes: { homeId, checkIn, checkOut, guests, nights: String(nights), totalPrice: String(total), guestId: req.user._id.toString() }
        });
        res.json({ orderId: order.id, amount: order.amount, currency: order.currency,
                   keyId: process.env.RAZORPAY_KEY_ID, nights, totalPrice: total,
                   homeName: home.houseName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not create order" });
    }
};

const finalizeBooking = async ({ homeId, guestId, checkIn, checkOut, guests, totalPrice, nights, razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    const existingBooking = await Booking.findOne({ razorpayOrderId });
    if (existingBooking) return existingBooking;

    const home = await Home.findById(homeId);
    const host = home ? await User.findById(home.owner) : null;
    const COMMISSION_PERCENT = getCommissionPercent(home, host); 
    const price = Number(totalPrice);
    const commission = Math.round((price * COMMISSION_PERCENT) / 100);
    const payoutAmount = price - commission;
    const payoutDueDate = new Date(new Date(checkOut).getTime() + 3 * 24 * 60 * 60 * 1000);
    const seq = await getNextSequence("bookingId");
    const bookingId = formatBookingId(seq);

    let booking;
    try {
        booking = await Booking.create({
            bookingId,
            home:              homeId,
            guest:             guestId,
            checkIn:           new Date(checkIn),
            checkOut:          new Date(checkOut),
            guests:            Number(guests),
            totalPrice:        price,
            nights:            Number(nights),
            status:            "upcoming",
            paymentStatus:     "paid",
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: razorpaySignature || "",
            platformCommissionPercent: COMMISSION_PERCENT,
            platformCommission:        commission,
            payoutAmount,
            payoutStatus:              "pending",
            payoutDueDate
        });
    } catch (err) {
        // E11000 = duplicate razorpayOrderId. A concurrent request
        // (double-click, client retry) already created this booking
        // between our findOne check above and this create() call —
        // fetch and return that one instead of throwing/duplicating.
        if (err.code === 11000) {
            const winner = await Booking.findOne({ razorpayOrderId });
            if (winner) return winner;
        }
        throw err;
    }

    User.findByIdAndUpdate(guestId, { $inc: { stays: 1 } }).catch(err =>
        console.error("stays increment failed:", err.message)
    );

    // fire-and-forget — do NOT await this in the request path
    sendBookingNotifications(booking._id, guestId).catch(err =>
        console.error("sendBookingNotifications failed:", err.message)
    );

    return booking;
};
// Runs after the response has already been sent to the client.
const sendBookingNotifications = async (bookingId, guestId) => {
    const populatedBooking = await Booking.findById(bookingId).populate("home");
    const home = populatedBooking.home;
    if (!home) return;
    const guest = await User.findById(guestId);
    const host = await User.findById(home.owner);

    await Promise.all([
        sendEmail(
            guest.email,
            "Your booking is confirmed — Roovia",
            bookingConfirmedTemplate(guest.fname, populatedBooking, home)
        ),
        host ? sendEmail(
            host.email,
            "New booking received — Roovia",
            hostNewBookingTemplate(host.fname, `${guest.fname} ${guest.lname}`, populatedBooking, home, guest.email, guest.phone)
        ) : Promise.resolve(),
        notify({
            userId: guestId,
            type: "booking_confirmed",
            title: "Booking confirmed",
            message: `Your stay at ${home.houseName} is confirmed for ${new Date(populatedBooking.checkIn).toLocaleDateString("en-IN")} – ${new Date(populatedBooking.checkOut).toLocaleDateString("en-IN")}.`,
            link: `/bookings/${bookingId}/confirmation`,
            icon: "booking",
            meta: { bookingId: bookingId.toString(), homeId: home._id.toString() }
        }),
        host ? notify({
            userId: host._id,
            type: "host_new_booking",
            title: "New booking received",
            message: `${populatedBooking.guests} guest(s) booked ${home.houseName} for ${new Date(populatedBooking.checkIn).toLocaleDateString("en-IN")} – ${new Date(populatedBooking.checkOut).toLocaleDateString("en-IN")}.`,
            link: `/host/dashboard`,
            icon: "booking",
            meta: { bookingId: bookingId.toString(), homeId: home._id.toString() }
        }) : Promise.resolve()
    ]);
};

export const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id, razorpay_payment_id, razorpay_signature,
            homeId, checkIn, checkOut, guests, totalPrice, nights
        } = req.body;
        const body      = razorpay_order_id + "|" + razorpay_payment_id;
        const expected  = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");
        if (expected !== razorpay_signature) {
            return res.status(400).json({ error: "Payment verification failed" });
        }
        const existingBooking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
        if (existingBooking) {
            return res.json({ success: true, bookingId: existingBooking._id });
        }
        const home = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({ error: "This home no longer exists" });
        }
        if (home.owner.toString() === req.user._id.toString()) {
            return res.status(403).json({ error: "You can't book your own listing" });
        }
        const stillAvailable = await isAvailable(homeId, new Date(checkIn), new Date(checkOut));
        if (!stillAvailable) {
            try {
                await getRazorpay().payments.refund(razorpay_payment_id, {
                    amount: Number(totalPrice) * 100,
                    speed: "normal",
                    notes: { reason: "Dates became unavailable before payment could be confirmed" }
                });
            } catch (refundErr) {
                console.error("Auto-refund failed for", razorpay_payment_id, ":", refundErr.message);
            }
            return res.status(409).json({
                error: "Sorry, those dates were just booked by someone else. Your payment has been refunded."
            });
        }
        let booking = await finalizeBooking({
            homeId, guestId: req.user._id, checkIn, checkOut, guests, totalPrice, nights,
            razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature
        });

        booking = await resolveBookingConflicts(booking);

        if (booking.status === "cancelled") {
            return res.status(409).json({
                error: "Sorry — someone else's payment for these dates was confirmed a moment before yours. You've been fully refunded.",
                bookingId: booking._id
            });
        }

        res.json({ success: true, bookingId: booking._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not save booking" });
    }
};

export const getBookings = async (req, res, next) => {
    try {
        const allBookings = await Booking.find({ guest: req.user._id })
            .populate({
                path: "home",
                populate: {
                    path: "owner",
                    select: "fname lname email phone profileImage"
                }
            })
            .sort({ createdAt: -1 });

        const bookings = allBookings.filter(b => b.home);
        const orphaned = allBookings.length - bookings.length;
        const Review = (await import("../models/review.js")).default;
        const reviewsList = await Review.find({ guest: req.user._id });
        const reviewsByBooking = {};
        reviewsList.forEach(r => {
            reviewsByBooking[r.booking.toString()] = r;
        });
        res.render("store/bookings", { pageTitle: "My Bookings", bookings, reviewsByBooking });
    } catch (err) {
        next(err);
    }
};

export const getConfirmation = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate("home");
        if (!booking || booking.guest.toString() !== req.user._id.toString()) {
            return res.redirect("/bookings");
        }
        if (!booking.home) {
            console.warn(`getConfirmation: booking ${booking._id} references a home that no longer exists.`);
            return res.redirect("/bookings");
        }
        res.render("store/bookingConfirmation", { pageTitle: "Booking Confirmed", booking });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

export const cancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate("home");
        if (!booking || booking.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        if (booking.status === "cancelled") {
            return res.redirect("/bookings");
        }
        const policy = (booking.home && booking.home.cancellationPolicy) || "moderate";
        const refundPercent = getRefundPercent(policy, booking.checkIn, new Date());
        const refundAmount  = Math.round(booking.totalPrice * refundPercent / 100);
        const retainedAmount = booking.totalPrice - refundAmount; // stays with host + platform
        if (booking.paymentStatus === "paid" && booking.razorpayPaymentId) {
    const alreadyPaidOutToHost = booking.payoutStatus === "paid";
    booking.refundAmount  = refundAmount;
    booking.refundPercent = refundPercent;

    if (alreadyPaidOutToHost) {
        // Host already has money in hand. Figure out what they should be left with
        // now that the booking is cancelled, and what they owe back.
        const originalPayoutAmount = booking.payoutAmount;
        const newHostShare = retainedAmount > 0
            ? retainedAmount - Math.round(retainedAmount * booking.platformCommissionPercent / 100)
            : 0;
        const repaymentOwed = Math.max(0, originalPayoutAmount - newHostShare);

        booking.platformCommission = booking.totalPrice - refundAmount - newHostShare;
        booking.payoutAmount       = newHostShare; // corrected final host share, for records

        if (repaymentOwed > 0) {
            booking.refundStatus         = "awaiting_host_repayment";
            booking.hostRepaymentAmount  = repaymentOwed;
            booking.hostRepaymentStatus  = "pending";
            booking.hostRepaymentDueAt   = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else {
            // Host doesn't actually owe anything back — refund guest straight away
            try {
                const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                    amount: refundAmount * 100, speed: "normal",
                    notes: { reason: `Guest cancelled (${policy}, ${refundPercent}%) — no host repayment needed` }
                });
                booking.razorpayRefundId = refund.id;
                booking.refundStatus = "initiated";
            } catch (refundErr) {
                console.error("Refund failed:", refundErr.message);
                booking.refundStatus = "failed";
            }
        }
    } else {
        // Host hasn't been paid yet — original logic, unchanged
        if (refundAmount > 0) {
            try {
                const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                    amount: refundAmount * 100, speed: "normal",
                    notes: { reason: `Guest cancelled (${policy} policy, ${refundPercent}% refund)` }
                });
                booking.razorpayRefundId = refund.id;
                booking.refundStatus = "initiated";
            } catch (refundErr) {
                console.error("Refund failed:", refundErr.message);
                booking.refundStatus = "failed";
            }
        } else {
            booking.refundStatus = "not_applicable";
        }
        if (retainedAmount > 0) {
            const hostShare = retainedAmount - Math.round(retainedAmount * booking.platformCommissionPercent / 100);
            booking.platformCommission = booking.totalPrice - refundAmount - hostShare;
            booking.payoutAmount  = hostShare;
            booking.payoutStatus  = hostShare > 0 ? "pending" : "not_applicable";
            booking.payoutDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        } else if (booking.payoutStatus === "pending") {
            booking.payoutStatus = "not_applicable";
        }
    }
}
        booking.status = "cancelled";
        await booking.save();
        if (booking.hostRepaymentStatus === "pending") {
    const host = await User.findById(booking.home.owner);
    if (host) {
        await notify({
            userId: host._id,
            type: "host_repayment_due",
            title: "You owe a repayment for a cancelled booking",
            message: `Booking ${booking.bookingId} was cancelled. Since you were already paid out, please send ₹${booking.hostRepaymentAmount} back to Roovia within 24 hours or your account will be suspended.`,
            link: `/host/manage/${booking.home._id}`,
            icon: "alert",
            meta: { bookingId: booking._id.toString() }
        });
    }
}
        try {
            const guest = req.user;
            const host  = await User.findById(booking.home.owner);
            await sendEmail(
                guest.email,
                "Your booking has been cancelled — Roovia",
                bookingCancelledGuestTemplate(guest.fname, booking, booking.home)
            );
            if (host) {
                await sendEmail(
                    host.email,
                    "A booking was cancelled — Roovia",
                    hostBookingCancelledTemplate(
                        host.fname,
                        `${guest.fname} ${guest.lname}`,
                        booking,
                        booking.home
                    )
                );
            }
        } catch (emailErr) {
            console.error("Cancellation email failed:", emailErr.message);
        }
        try {
            const guest = req.user;
            const host  = await User.findById(booking.home.owner);
            await notify({
                userId: guest._id,
                type: "booking_cancelled",
                title: "Booking cancelled",
                message: `Your booking at ${booking.home.houseName} has been cancelled.${booking.refundAmount > 0 ? ` ₹${booking.refundAmount} refund initiated.` : ""}`,
                link: `/bookings`,
                icon: "cancel",
                meta: { bookingId: booking._id.toString() }
            });
            if (host) {
                await notify({
                    userId: host._id,
                    type: "host_booking_cancelled",
                    title: "A booking was cancelled",
                    message: `${guest.fname} ${guest.lname} cancelled their booking at ${booking.home.houseName}.`,
                    link: `/host/dashboard`,
                    icon: "cancel",
                    meta: { bookingId: booking._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Cancellation notification failed:", notifyErr.message);
        }
        res.redirect("/bookings");
    } catch (err) {
        next(err);
    }
};

const MIN_HOURS_BEFORE_CHECKIN_TO_MODIFY = 24;
const assertModifiable = (booking) => {
    if (booking.status !== "upcoming") {
        throw Object.assign(new Error("Only upcoming bookings can be modified"), { status: 400 });
    }
    const hoursUntilCheckIn = (new Date(booking.checkIn).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilCheckIn < MIN_HOURS_BEFORE_CHECKIN_TO_MODIFY) {
        throw Object.assign(new Error(`Trips can only be modified at least ${MIN_HOURS_BEFORE_CHECKIN_TO_MODIFY} hours before check-in`), { status: 400 });
    }
};

export const getModificationQuote = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate("home");
        if (!booking || booking.guest.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Forbidden" });
        }
        assertModifiable(booking);
        const { checkIn, checkOut, guests } = req.body;
        const inDate  = new Date(checkIn);
        const outDate = new Date(checkOut);
        if (isNaN(inDate) || isNaN(outDate) || outDate <= inDate) {
            return res.status(400).json({ error: "Invalid dates" });
        }
        if (Number(guests) > booking.home.maxGuests) {
            return res.status(400).json({ error: `This home sleeps a max of ${booking.home.maxGuests} guests` });
        }
        const available = await isAvailable(booking.home._id, inDate, outDate, booking._id);
        if (!available) {
            return res.status(409).json({ error: "Those new dates aren't available" });
        }
        const nights = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
        const newTotal = getTotalPriceForRange(booking.home, inDate, outDate);
        const diff = newTotal - booking.totalPrice; // positive = guest owes more, negative = refund owed
        let razorpayOrder = null;
        if (diff > 0) {
            try {
                razorpayOrder = await getRazorpay().orders.create({
                amount: Math.round(diff * 100),
                currency: "INR",
                receipt: `mod_${booking._id.toString().slice(-10)}_${Date.now()}`,  
                notes: {
                    bookingId: booking._id.toString(),
                    newCheckIn: checkIn, newCheckOut: checkOut, newGuests: String(guests),
                    newTotal: String(newTotal)
                }
            });
            } catch (rzpErr) {
                console.error("Razorpay order creation failed (modify quote):", rzpErr.error || rzpErr);
                return res.status(502).json({
                    error: rzpErr.error?.description || "Payment gateway couldn't quote this price difference"
                });
            }
        }
        res.json({
            nights, newTotal, oldTotal: booking.totalPrice, diff,
            requiresPayment: diff > 0,
            razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
            amount: razorpayOrder ? razorpayOrder.amount : 0,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({ error: err.message || "Could not quote modification" });
    }
};

export const confirmModification = async (req, res) => {
    try {
        let booking = await Booking.findById(req.params.id).populate("home");
        if (!booking || booking.guest.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Forbidden" });
        }
        assertModifiable(booking);
        const { checkIn, checkOut, guests, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const inDate  = new Date(checkIn);
        const outDate = new Date(checkOut);
        if (isNaN(inDate) || isNaN(outDate) || outDate <= inDate) {
            return res.status(400).json({ error: "Invalid dates" });
        }
        const available = await isAvailable(booking.home._id, inDate, outDate, booking._id);
        if (!available) {
            return res.status(409).json({ error: "Those new dates were just booked by someone else" });
        }
        const nights = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
        const newTotal = getTotalPriceForRange(booking.home, inDate, outDate);   
        const diff = newTotal - booking.totalPrice;
        if (diff > 0) {
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return res.status(400).json({ error: "Payment details missing for this change" });
            }
            const expected = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(razorpay_order_id + "|" + razorpay_payment_id)
                .digest("hex");
            if (expected !== razorpay_signature) {
                return res.status(400).json({ error: "Payment verification failed" });
            }
        } else if (diff < 0) {
            try {
                const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                    amount: Math.round(Math.abs(diff) * 100),
                    speed: "normal",
                    notes: { reason: "Trip modification — new dates cost less", bookingId: booking._id.toString() }
                });
                booking.razorpayRefundId = refund.id;
            } catch (refundErr) {
                console.error("Modification refund failed:", refundErr.error || refundErr);
                return res.status(502).json({
                    error: refundErr.error?.description || "Couldn't process the refund for the price difference — nothing has been changed yet."
                });
            }
        }
        if (!booking.originalCheckIn) {
            booking.originalCheckIn  = booking.checkIn;
            booking.originalCheckOut = booking.checkOut;
        }
        booking.checkIn    = inDate;
        booking.checkOut   = outDate;
        booking.guests     = Number(guests);
        booking.nights     = nights;
        booking.totalPrice = newTotal;
        booking.modificationCount += 1;
        booking.lastModifiedAt = new Date();
        const host = await User.findById(booking.home.owner);
        const commissionPercent = getCommissionPercent(booking.home, host);
        booking.platformCommissionPercent = commissionPercent;
        const commission = Math.round((newTotal * commissionPercent) / 100);
        booking.platformCommission = commission;
        booking.payoutAmount       = newTotal - commission;
        booking.payoutDueDate      = new Date(outDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        await booking.save();
        booking = await resolveBookingConflicts(booking);   // add this line
        if (booking.status === "cancelled") {
            return res.status(409).json({
                error: "Someone else's booking was confirmed for overlapping dates a moment before your change saved. Your change has been reverted and you've been refunded.",
                bookingId: booking._id
            });
        }
        await logAudit({
            actorType: "guest",
            actorId: req.user._id,
            action: "booking_modified", targetType: "Booking", targetId: booking._id,
            details: `New dates: ${inDate.toISOString().slice(0,10)} → ${outDate.toISOString().slice(0,10)}, price diff ₹${diff}`
        });
        try {
            const guest = req.user;
            const host  = await User.findById(booking.home.owner);
            if (host) {
                await sendEmail(
                    host.email,
                    "A guest changed their trip dates — Roovia",
                    hostBookingModifiedTemplate(host.fname, `${guest.fname} ${guest.lname}`, booking, booking.home)
                );
            }
        } catch (emailErr) {
            console.error("Modification email failed:", emailErr.message);
        }
        try {
            const guest = req.user;
            const host  = await User.findById(booking.home.owner);
            const diffMsg = diff > 0
                ? ` An extra ₹${diff} was charged.`
                : diff < 0
                    ? ` ₹${Math.abs(diff)} was refunded.`
                    : "";
            await notify({
                userId: guest._id,
                type: diff !== 0 ? "payment_updated" : "booking_modified",
                title: "Trip dates updated",
                message: `Your stay at ${booking.home.houseName} is now ${new Date(inDate).toLocaleDateString("en-IN")} – ${new Date(outDate).toLocaleDateString("en-IN")}.${diffMsg}`,
                link: `/bookings`,
                icon: "calendar",
                meta: { bookingId: booking._id.toString() }
            });
            if (host) {
                await notify({
                    userId: host._id,
                    type: "host_booking_modified",
                    title: "Booking updated",
                    message: `${guest.fname} ${guest.lname} changed their trip dates at ${booking.home.houseName}.`,
                    link: `/host/dashboard`,
                    icon: "calendar",
                    meta: { bookingId: booking._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Modification notification failed:", notifyErr.message);
        }
        res.json({ success: true, bookingId: booking._id, newTotal, diff });
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({ error: err.message || "Could not apply modification" });
    }
};

export const razorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const expected  = crypto
            .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(req.body)        
            .digest("hex");
        if (expected !== signature) {
            return res.status(400).json({ error: "Invalid signature" });
        }
        const event = JSON.parse(req.body.toString());
        if (event.event === "refund.processed") {
            const paymentId = event.payload.refund.entity.payment_id;
            await Booking.findOneAndUpdate(
                { razorpayPaymentId: paymentId },
                { refundStatus: "processed" }
            );
        }
        res.json({ received: true });
    } catch (err) {
        console.error("Webhook error:", err.message);
        res.status(500).json({ error: "Webhook failed" });
    }
};

export const downloadInvoice = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate("home").populate("guest");
        if (!booking || booking.guest._id.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        if (booking.paymentStatus !== "paid") {
            return res.status(400).send("Invoice is only available once a booking is confirmed and paid");
        }
        const host = await User.findById(booking.home.owner);
        const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="invoice-${booking._id}.pdf"`);
        doc.pipe(res);

        const GOLD = "#C9A96E";
        const DARK = "#1a1208";
        const GRAY = "#6b7280";
        const LIGHT = "#f3f4f6";
        const BORDER = "#e5e7eb";
        const PAGE_W = 595.28;
        const MARGIN = 50;
        const CONTENT_W = PAGE_W - MARGIN * 2;

        // ===== Header band =====
        doc.rect(0, 0, PAGE_W, 110).fill(DARK);
        doc.fillColor(GOLD).fontSize(24).font("Helvetica-Bold").text("ROOVIA", MARGIN, 34);
        doc.fillColor("#c9c9c9").fontSize(9).font("Helvetica").text("Stays with soul.", MARGIN, 62);

        doc.fillColor("#fff").fontSize(18).font("Helvetica-Bold")
           .text("INVOICE", 0, 34, { align: "right", width: PAGE_W - MARGIN });
        doc.fillColor("#c9c9c9").fontSize(9).font("Helvetica")
           .text(`#${booking.bookingId || booking._id}`, 0, 58, { align: "right", width: PAGE_W - MARGIN })
           .text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), 0, 72, { align: "right", width: PAGE_W - MARGIN });

        let y = 140;

        // ===== Status badge =====
        const badge = (label, bg, fg) => {
            const w = doc.widthOfString(label.toUpperCase()) + 20;
            const x = PAGE_W - MARGIN - w;
            doc.roundedRect(x, y, w, 20, 10).fill(bg);
            doc.fillColor(fg).fontSize(9).font("Helvetica-Bold").text(label.toUpperCase(), x, y + 6, { width: w, align: "center" });
        };
        doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text("Booking status", MARGIN, y + 4);
        badge(booking.paymentStatus, "#dcfce7", "#166534");
        y += 36;

        // ===== Billed to / Host two-column boxes =====
        const boxW = (CONTENT_W - 16) / 2;
        doc.roundedRect(MARGIN, y, boxW, 78, 6).fillAndStroke(LIGHT, BORDER);
        doc.roundedRect(MARGIN + boxW + 16, y, boxW, 78, 6).fillAndStroke(LIGHT, BORDER);

        doc.fillColor(GRAY).fontSize(9).font("Helvetica-Bold").text("BILLED TO", MARGIN + 14, y + 12);
        doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text(`${booking.guest.fname} ${booking.guest.lname}`, MARGIN + 14, y + 28);
        doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(booking.guest.email, MARGIN + 14, y + 46);

        doc.fillColor(GRAY).fontSize(9).font("Helvetica-Bold").text("HOSTED BY", MARGIN + boxW + 30, y + 12);
        doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text(host ? `${host.fname} ${host.lname}` : "N/A", MARGIN + boxW + 30, y + 28);
        doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(host?.email || "", MARGIN + boxW + 30, y + 46);

        y += 100;

        // ===== Stay if (booking.paymentStatus === "paid" && booking.razorpayPaymentId) {
            if (refundAmount > 0) {
                try {
                    const refund = await getRazorpay().payments.refund(
                        booking.razorpayPaymentId,
                        {
                            amount: refundAmount * 100,
                            speed: "normal",
                            notes: { reason: `Guest cancelled (${policy} policy, ${refundPercent}% refund)` }
                        }
                    );
                    booking.razorpayRefundId = refund.id;
                    booking.refundStatus     = "initiated";
                } catch (refundErr) {
                    console.error("Refund failed:", refundErr.message);
                    booking.refundStatus = "failed";
                }
            } else {
                booking.refundStatus = "not_applicable"; 
            }
            booking.refundAmount  = refundAmount;
            booking.refundPercent = refundPercent;
            if (retainedAmount > 0) {
                const hostShare = retainedAmount - Math.round(retainedAmount * booking.platformCommissionPercent / 100);
                booking.platformCommission = booking.totalPrice - refundAmount - hostShare;
                booking.payoutAmount  = hostShare;
                booking.payoutStatus  = hostShare > 0 ? "pending" : "not_applicable";
                booking.payoutDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            } else if (booking.payoutStatus === "pending") {
                booking.payoutStatus = "not_applicable";
            }
        }details box =====
        doc.roundedRect(MARGIN, y, CONTENT_W, 100, 6).stroke(BORDER);
        doc.fillColor(DARK).fontSize(13).font("Helvetica-Bold").text(booking.home.houseName, MARGIN + 16, y + 14);
        doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(` ${booking.home.location}`, MARGIN + 16, y + 32);

        const detailCol = (label, value, x) => {
            doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(label.toUpperCase(), x, y + 58);
            doc.fillColor(DARK).fontSize(10).font("Helvetica").text(value, x, y + 70);
        };
        const colW = (CONTENT_W - 32) / 4;
        detailCol("Check-in", new Date(booking.checkIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), MARGIN + 16);
        detailCol("Check-out", new Date(booking.checkOut).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), MARGIN + 16 + colW);
        detailCol("Nights", String(booking.nights), MARGIN + 16 + colW * 2);
        detailCol("Guests", String(booking.guests), MARGIN + 16 + colW * 3);

        y += 124;

        // ===== Itemized table =====
        doc.rect(MARGIN, y, CONTENT_W, 24).fill(DARK);
        doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold");
        doc.text("DESCRIPTION", MARGIN + 12, y + 8, { width: 300 });
        doc.text("AMOUNT", MARGIN, y + 8, { width: CONTENT_W - 12, align: "right" });
        y += 24;

        const row = (label, value, highlight = false) => {
            if (highlight) doc.rect(MARGIN, y, CONTENT_W, 26).fill(LIGHT);
            doc.fillColor(highlight ? DARK : "#374151").fontSize(highlight ? 11 : 10).font(highlight ? "Helvetica-Bold" : "Helvetica");
            doc.text(label, MARGIN + 12, y + (highlight ? 7 : 8), { width: 300 });
            doc.text(value, MARGIN, y + (highlight ? 7 : 8), { width: CONTENT_W - 12, align: "right" });
            y += 26;
        };
        row(`Rs ${booking.home.price} × ${booking.nights} night${booking.nights !== 1 ? "s" : ""}`, `Rs ${(booking.nights * booking.home.price).toLocaleString("en-IN")}`);
        if (booking.refundAmount > 0) {
            row("Refunded", `-Rs  ${booking.refundAmount.toLocaleString("en-IN")}`);
        }
        doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(BORDER).stroke();
        row("Total paid", `Rs ${booking.totalPrice.toLocaleString("en-IN")}`, true);

        y += 20;
        if (booking.razorpayPaymentId) {
            doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(`Payment reference: ${booking.razorpayPaymentId}`, MARGIN, y);
            y += 18;
        }

        // ===== Footer =====
        doc.fillColor(GRAY).fontSize(9).font("Helvetica")
           .text("Thank you for booking with Roovia. Questions about this invoice? Reply to your booking confirmation email.", MARGIN, 760, { width: CONTENT_W, align: "center" });

        doc.end();
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const resolveBookingConflicts = async (booking) => {
    const overlapping = await Booking.find({
        home: booking.home,
        status: { $ne: "cancelled" },
        paymentStatus: "paid",
        checkIn:  { $lt: booking.checkOut },
        checkOut: { $gt: booking.checkIn }
    }).sort({ createdAt: 1, _id: 1 });

    if (overlapping.length <= 1) {
        return booking;
    }
    const winner = overlapping[0];
    const losers = overlapping.filter(b => b._id.toString() !== winner._id.toString());

    for (const loser of losers) {
        const updated = await Booking.findOneAndUpdate(
            { _id: loser._id, status: "upcoming" },
            { status: "cancelled", refundStatus: loser.paymentStatus === "paid" ? "initiated" : "not_applicable" },
            { new: true }
        );
        if (!updated) continue; 
        if (loser.paymentStatus === "paid" && loser.razorpayPaymentId) {
            try {
                const refund = await getRazorpay().payments.refund(loser.razorpayPaymentId, {
                    amount: loser.totalPrice * 100,
                    speed: "normal",
                    notes: { reason: "Double-booking race detected — auto-refunded" }
                });
                await Booking.findByIdAndUpdate(loser._id, {
                    razorpayRefundId: refund.id,
                    refundStatus: "initiated",
                    refundAmount: loser.totalPrice,
                    refundPercent: 100,
                    payoutStatus: "not_applicable"
                });
            } catch (refundErr) {
                console.error("Auto-refund failed for double-booking loser", loser._id.toString(), ":", refundErr.message);
                await Booking.findByIdAndUpdate(loser._id, { refundStatus: "failed" });
            }
        }
        try {
            const loserWithHome = await Booking.findById(loser._id).populate("home");
            const guest = await User.findById(loser.guest);
            if (guest && loserWithHome.home) {
                await sendEmail(
                    guest.email,
                    "Your booking has been cancelled — Roovia",
                    bookingCancelledGuestTemplate(guest.fname, loserWithHome, loserWithHome.home)
                );
                await notify({
                    userId: guest._id,
                    type: "booking_cancelled",
                    title: "Booking cancelled — dates conflict",
                    message: `Someone else's payment for ${loserWithHome.home.houseName} was confirmed a moment before yours for the same dates. You've been fully refunded ₹${loser.totalPrice}.`,
                    link: `/bookings`,
                    icon: "cancel",
                    meta: { bookingId: loser._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Double-booking conflict notification failed:", notifyErr.message);
        }
    }
    return Booking.findById(booking._id);
};

export const HOST_CANCEL_REASONS = {
    maintenance:   "Your host has had to cancel due to an unexpected maintenance issue at the property.",
    double_booked: "Your host has had to cancel due to a scheduling conflict with this listing.",
    unavailable:   "Your host is no longer able to accommodate this stay.",
    other:         "Unfortunately your host has had to cancel this booking."
};

export const cancelBookingAsHost = async (bookingId, note) => {
    const booking = await Booking.findById(bookingId).populate("home").populate("guest");
    if (!booking || booking.status === "cancelled") return null;

    if (booking.paymentStatus === "paid" && booking.razorpayPaymentId) {
    booking.refundAmount  = booking.totalPrice;   // host's fault → full refund, always
    booking.refundPercent = 100;

    const alreadyPaidOutToHost = booking.payoutStatus === "paid";
    if (alreadyPaidOutToHost) {
        // Host has the full payout in hand — host's fault means 0% retained,
        // so they owe back the entire original payout.
        const repaymentOwed = booking.payoutAmount;
        booking.platformCommission = 0;
        booking.payoutAmount       = 0;
        if (repaymentOwed > 0) {
            booking.refundStatus        = "awaiting_host_repayment";
            booking.hostRepaymentAmount = repaymentOwed;
            booking.hostRepaymentStatus = "pending";
            booking.hostRepaymentDueAt  = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else {
            try {
                const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                    amount: booking.totalPrice * 100, speed: "normal",
                    notes: { reason: "Host cancelled booking — no repayment owed" }
                });
                booking.razorpayRefundId = refund.id;
                booking.refundStatus = "initiated";
            } catch (refundErr) {
                console.error("Host-cancel refund failed:", refundErr.message);
                booking.refundStatus = "failed";
            }
        }
    } else {
        try {
            const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                amount: booking.totalPrice * 100, speed: "normal",
                notes: { reason: "Host cancelled booking" }
            });
            booking.razorpayRefundId = refund.id;
            booking.refundStatus = "initiated";
        } catch (refundErr) {
            console.error("Host-cancel refund failed:", refundErr.message);
            booking.refundStatus = "failed";
        }
        booking.payoutAmount = 0;
        booking.payoutStatus = "not_applicable";
    }
}
    booking.status = "cancelled";
    booking.cancelledBy = "host";
    booking.hostCancelNote = note;
    await booking.save();

    try {
        await sendEmail(
            booking.guest.email,
            "Your booking was cancelled by the host — Roovia",
            hostCancelledGuestTemplate(booking.guest.fname, booking, booking.home, note)
        );
    } catch (e) { console.error("Host-cancel email failed:", e.message); }

    try {
        await notify({
            userId: booking.guest._id,
            type: "booking_cancelled",
            title: "Your booking was cancelled by the host",
            message: `Your stay at ${booking.home.houseName} was cancelled. ₹${booking.refundAmount} refund initiated.`,
            link: `/bookings`,
            icon: "cancel",
            meta: { bookingId: booking._id.toString() }
        });
    } catch (e) { console.error("Host-cancel notification failed:", e.message); }
    try {
        await notify({
            userId: booking.home.owner,
            type: "host_booking_cancelled",
            title: "You cancelled a booking",
            message: `You cancelled the booking for ${booking.home.houseName}. Guest was refunded ₹${booking.refundAmount}.`,
            link: `/host/dashboard`,
            icon: "cancel",
            meta: { bookingId: booking._id.toString() }
        });
    } catch (e) { console.error("Host-cancel self-notification failed:", e.message); }
    recomputeHostStats(booking.home.owner).catch(e => console.error("Host stats recompute failed:", e.message)); // NEW
    if (booking.hostRepaymentStatus === "pending") {
    try {
        await notify({
            userId: booking.home.owner,
            type: "host_repayment_due",
            title: "You owe a repayment for this cancellation",
            message: `You already received the payout for this booking. Since you cancelled it, send ₹${booking.hostRepaymentAmount} back to Roovia within 24 hours or your account will be suspended.`,
            link: `/host/manage/${booking.home._id}`,
            icon: "alert",
            meta: { bookingId: booking._id.toString() }
        });
    } catch (e) { console.error("Host-cancel repayment notification failed:", e.message); }
}
    return booking;
};

export const hostCancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate("home");
        if (!booking || !booking.home || booking.home.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        const { noteType, predefinedReason, customNote, returnTo } = req.body;
        const note = noteType === "custom"
            ? (customNote || "").trim().slice(0, 1000) || HOST_CANCEL_REASONS.other
            : (HOST_CANCEL_REASONS[predefinedReason] || HOST_CANCEL_REASONS.other);
        await cancelBookingAsHost(booking._id, note);
        const safeReturnTo = typeof returnTo === "string" && returnTo.startsWith("/host/manage/")
            ? returnTo
            : "/host/dashboard";
        res.redirect(safeReturnTo);
    } catch (err) { next(err); }
};

export const markHostRepaymentSent = async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate("home");
    if (!booking || !booking.home || booking.home.owner.toString() !== req.user._id.toString()) {
        return res.status(403).send("Forbidden");
    }
    if (booking.hostRepaymentStatus !== "pending") return res.redirect("/host/dashboard");
    booking.hostRepaymentMarkedSentAt = new Date();
    await booking.save();
    res.redirect(`/host/manage/${booking.home._id}`);
};

export const bookingController = {checkAvailability, createOrder, verifyPayment,getBookings, getConfirmation, cancelBooking,getModificationQuote, confirmModification, razorpayWebhook, downloadInvoice, resolveBookingConflicts, cancelBookingAsHost, hostCancelBooking,markHostRepaymentSent};
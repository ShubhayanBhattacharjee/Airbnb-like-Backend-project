import Razorpay from "razorpay";
import crypto from "crypto";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Home from "../models/home.js";
import { sendEmail } from "../utils/sendEmail.js";
import {bookingConfirmedTemplate,hostNewBookingTemplate,bookingCancelledGuestTemplate,hostBookingCancelledTemplate,hostBookingModifiedTemplate} from "../utils/emailTemplates.js";
import { getRefundPercent } from "../utils/cancellationPolicy.js";
import { logAudit } from "../utils/auditLog.js";

const getRazorpay = () => new Razorpay({
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
        const total  = nights * home.price;
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
        const available = await isAvailable(homeId, inDate, outDate);
        if (!available) {
            return res.status(409).json({ error: "Dates no longer available" });
        }
        const home   = await Home.findById(homeId);
        const nights = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
        const total  = nights * home.price;
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

    const COMMISSION_PERCENT = Number(process.env.PLATFORM_COMMISSION_PERCENT) || 10;
    const price = Number(totalPrice);
    const commission = Math.round((price * COMMISSION_PERCENT) / 100);
    const payoutAmount = price - commission;
    const payoutDueDate = new Date(new Date(checkOut).getTime() + 3 * 24 * 60 * 60 * 1000);

    const booking = await Booking.create({
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
    await User.findByIdAndUpdate(guestId, { $inc: { stays: 1 } });

    try {
        const populatedBooking = await Booking.findById(booking._id).populate("home");
        const home = populatedBooking.home;
        const guest = await User.findById(guestId);
        const host = await User.findById(home.owner);
        await sendEmail(
            guest.email,
            "Your booking is confirmed — HomeStays",
            bookingConfirmedTemplate(guest.fname, populatedBooking, home)
        );
        if (host) {
            await sendEmail(
                host.email,
                "New booking received — HomeStays",
                hostNewBookingTemplate(host.fname, `${guest.fname} ${guest.lname}`, populatedBooking, home)
            );
        }
    } catch (emailErr) {
        console.error("Booking email failed:", emailErr.message);
    }

    return booking;
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
        const booking = await finalizeBooking({
            homeId, guestId: req.user._id, checkIn, checkOut, guests, totalPrice, nights,
            razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature
        });
        res.json({ success: true, bookingId: booking._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not save booking" });
    }
};

export const getBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ guest: req.user._id })
            .populate("home")
            .sort({ createdAt: -1 });
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
                booking.refundStatus = "not_applicable"; // policy allows 0% refund at this point
            }
            booking.refundAmount  = refundAmount;
            booking.refundPercent = refundPercent;
            if (retainedAmount > 0) {
                const hostShare = retainedAmount - Math.round(retainedAmount * booking.platformCommissionPercent / 100);
                booking.platformCommission = booking.totalPrice - refundAmount - hostShare;
                booking.payoutAmount  = hostShare;
                booking.payoutStatus  = hostShare > 0 ? "pending" : "not_applicable";
                // No check-out will happen now, so pay the host within 3 days of the cancellation itself.
                booking.payoutDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            } else if (booking.payoutStatus === "pending") {
                booking.payoutStatus = "not_applicable";
            }
        }
        booking.status = "cancelled";
        await booking.save();
        try {
            const guest = req.user;
            const host  = await User.findById(booking.home.owner);
            await sendEmail(
                guest.email,
                "Your booking has been cancelled — HomeStays",
                bookingCancelledGuestTemplate(guest.fname, booking, booking.home)
            );
            if (host) {
                await sendEmail(
                    host.email,
                    "A booking was cancelled — HomeStays",
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
        const newTotal = nights * booking.home.price;
        const diff = newTotal - booking.totalPrice; // positive = guest owes more, negative = refund owed

        let razorpayOrder = null;
        if (diff > 0) {
            razorpayOrder = await getRazorpay().orders.create({
                amount: diff * 100,
                currency: "INR",
                receipt: `modify_${booking._id}_${Date.now()}`,
                notes: {
                    bookingId: booking._id.toString(),
                    newCheckIn: checkIn, newCheckOut: checkOut, newGuests: String(guests),
                    newTotal: String(newTotal)
                }
            });
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
        const booking = await Booking.findById(req.params.id).populate("home");
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
        const newTotal = nights * booking.home.price;
        const diff = newTotal - booking.totalPrice;

        if (diff > 0) {
            // Extra payment required — verify it the same way a fresh booking payment is verified.
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
            // New dates are cheaper — refund the difference onto the original payment.
            try {
                const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                    amount: Math.abs(diff) * 100,
                    speed: "normal",
                    notes: { reason: "Trip modification — new dates cost less", bookingId: booking._id.toString() }
                });
                booking.razorpayRefundId = refund.id;
            } catch (refundErr) {
                console.error("Modification refund failed:", refundErr.message);
                return res.status(500).json({ error: "Couldn't process the refund for the price difference — nothing has been changed yet." });
            }
        }

        // Preserve what was originally booked, the first time this booking is ever modified.
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

        // Recompute commission/payout on the new total (booking hasn't happened yet, so this is safe).
        const commission = Math.round((newTotal * booking.platformCommissionPercent) / 100);
        booking.platformCommission = commission;
        booking.payoutAmount       = newTotal - commission;
        booking.payoutDueDate      = new Date(outDate.getTime() + 3 * 24 * 60 * 60 * 1000);

        await booking.save();

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
                    "A guest changed their trip dates — HomeStays",
                    hostBookingModifiedTemplate(host.fname, `${guest.fname} ${guest.lname}`, booking, booking.home)
                );
            }
        } catch (emailErr) {
            console.error("Modification email failed:", emailErr.message);
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

export const bookingController = {checkAvailability, createOrder, verifyPayment,getBookings, getConfirmation, cancelBooking,getModificationQuote, confirmModification, razorpayWebhook};
import Razorpay from "razorpay";
import crypto from "crypto";
import Booking from "../models/booking.js";
import User from "../models/user.js";
import Home from "../models/home.js";
import { sendEmail } from "../utils/sendEmail.js";
import {bookingConfirmedTemplate,hostNewBookingTemplate,bookingCancelledGuestTemplate,hostBookingCancelledTemplate} from "../utils/emailTemplates.js";

const getRazorpay = () => new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const isAvailable = async (homeId, checkIn, checkOut) => {
    const home = await Home.findById(homeId);
    if (!home) return false;
    const blockedConflict = home.blockedDates.some(b =>
        checkIn < b.to && checkOut > b.from
    );
    if (blockedConflict) return false;
    const bookingConflict = await Booking.findOne({
        home: homeId,
        status: { $ne: "cancelled" },
        paymentStatus: "paid",
        $or: [
            { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }
        ]
    });
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
            notes: { homeId, checkIn, checkOut, guests }
        });
        res.json({ orderId: order.id, amount: order.amount, currency: order.currency,
                   keyId: process.env.RAZORPAY_KEY_ID, nights, totalPrice: total,
                   homeName: home.houseName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not create order" });
    }
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
        const booking = await Booking.create({
            home:              homeId,
            guest:             req.user._id,
            checkIn:           new Date(checkIn),
            checkOut:          new Date(checkOut),
            guests:            Number(guests),
            totalPrice:        Number(totalPrice),
            nights:            Number(nights),
            status:            "upcoming",
            paymentStatus:     "paid",
            razorpayOrderId:   razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        });
        await User.findByIdAndUpdate(req.user._id, { $inc: { stays: 1 } });
        try {
            const populatedBooking = await Booking.findById(booking._id).populate("home");
            const home = populatedBooking.home;
            const guest = req.user;
            const host = await User.findById(home.owner);
            await sendEmail(
                guest.email,
                "Your booking is confirmed — HomeStays",
                bookingConfirmedTemplate(
                    guest.fname,
                    populatedBooking,
                    home
                )
            );
            if (host) {
                await sendEmail(
                    host.email,
                    "New booking received — HomeStays",
                    hostNewBookingTemplate(
                        host.fname,
                        `${guest.fname} ${guest.lname}`,
                        populatedBooking,
                        home
                    )
                );
            }
        } catch (emailErr) {
            console.error("Booking email failed:", emailErr.message);
        }
        res.json({ success: true, bookingId: booking._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not save booking" });
    }
};

export const getBookings = async (req, res) => {
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
        res.status(500).send("Server error");
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
        if (booking.paymentStatus === "paid" && booking.razorpayPaymentId) {
            try {
                const refund = await getRazorpay().payments.refund(
                    booking.razorpayPaymentId,
                    {
                        amount: booking.totalPrice * 100,
                        speed: "normal",
                        notes: { reason: "Guest cancelled booking" }
                    }
                );
                booking.razorpayRefundId = refund.id;
                booking.refundStatus     = "initiated";
            } catch (refundErr) {
                next(err);
                booking.refundStatus = "failed";
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
            next(err);
        }
        res.redirect("/bookings");
    } catch (err) {
        next(err);
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

export const bookingController = {checkAvailability, createOrder, verifyPayment,getBookings, getConfirmation, cancelBooking,razorpayWebhook};
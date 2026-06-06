import Razorpay from "razorpay";
import crypto from "crypto";
import Booking from "../models/booking.js";
import Home from "../models/home.js";

const getRazorpay = () => new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Helper: check if a date range overlaps any existing booking or blocked date
const isAvailable = async (homeId, checkIn, checkOut) => {
    const home = await Home.findById(homeId);
    if (!home) return false;

    // Check blocked dates set by host
    const blockedConflict = home.blockedDates.some(b =>
        checkIn < b.to && checkOut > b.from
    );
    if (blockedConflict) return false;

    // Check existing confirmed bookings
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

// GET /bookings/check-availability?homeId=&checkIn=&checkOut=
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

// POST /bookings/create-order  — creates Razorpay order
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

// POST /bookings/verify-payment  — verifies signature, saves booking
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

        res.json({ success: true, bookingId: booking._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not save booking" });
    }
};

// GET /bookings — user's bookings list
export const getBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ guest: req.user._id })
            .populate("home")
            .sort({ createdAt: -1 });
        res.render("store/bookings", { pageTitle: "My Bookings", bookings });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

// GET /bookings/confirmation/:id
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

// POST /bookings/cancel/:id
export const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking || booking.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        booking.status = "cancelled";
        await booking.save();
        res.redirect("/bookings");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

export const bookingController = {
    checkAvailability, createOrder, verifyPayment,
    getBookings, getConfirmation, cancelBooking
};
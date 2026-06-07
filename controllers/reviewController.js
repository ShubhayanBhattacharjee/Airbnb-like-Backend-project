import Review from "../models/review.js";
import Booking from "../models/booking.js";
import Home from "../models/home.js";

export const postReview = async (req, res, next) => {
    try {
        const { bookingId, rating, comment } = req.body;
        const ratingNum = parseInt(rating, 10);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).send("Rating must be between 1 and 5");
        }
        if (!comment || comment.trim().length < 10) {
            return res.status(400).send("Review must be at least 10 characters");
        }
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).send("Booking not found");
        if (booking.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        if (booking.status !== "completed") {
            return res.status(400).send("You can only review completed stays");
        }
        if (booking.hasReviewed) {
            return res.status(400).send("You have already reviewed this stay");
        }
        await Review.create({
            home:    booking.home,
            guest:   req.user._id,
            booking: bookingId,
            rating:  ratingNum,
            comment: comment.trim()
        });
        booking.hasReviewed = true;
        await booking.save();
        const stats = await Review.aggregate([
            { $match: { home: booking.home } },
            { $group: {
                _id: null,
                avg:   { $avg: "$rating" },
                count: { $sum: 1 }
            }}
        ]);
        if (stats.length > 0) {
            await Home.findByIdAndUpdate(booking.home, {
                avgRating:   Math.round(stats[0].avg * 10) / 10,
                reviewCount: stats[0].count
            });
        }
        res.redirect("/bookings");
    } catch (err) {
        next(err);
    }
};

export const getHomeReviews = async (req, res, next) => {
    try {
        const reviews = await Review.find({ home: req.params.homeId })
            .populate("guest", "fname lname profileImage")
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        next(err);
    }
};
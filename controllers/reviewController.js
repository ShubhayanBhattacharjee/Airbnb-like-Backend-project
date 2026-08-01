import Review from "../models/review.js";
import Booking from "../models/booking.js";
import Home from "../models/home.js";

import { notify } from "../utils/notify.js";

export const postReview = async (req, res, next) => {
    try {
        const { bookingId, rating, comment, cleanliness, accuracy, checkin, communication, location, value } = req.body;
        const ratingNum = parseInt(rating, 10);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).send("Rating must be between 1 and 5");
        }
        if (!comment || comment.trim().length < 10) {
            return res.status(400).send("Review must be at least 10 characters");
        }

        const subRatings = { cleanliness, accuracy, checkin, communication, location, value };
        const parsedSubRatings = {};
        for (const [key, val] of Object.entries(subRatings)) {
            const n = parseInt(val, 10);
            if (!n || n < 1 || n > 5) {
                return res.status(400).send(`Please rate "${key}" between 1 and 5`);
            }
            parsedSubRatings[key] = n;
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
            comment: comment.trim(),
            ...parsedSubRatings
        });
        booking.hasReviewed = true;
        await booking.save();
        const stats = await Review.aggregate([
            { $match: { home: booking.home } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);
        if (stats.length > 0) {
            await Home.findByIdAndUpdate(booking.home, {
                avgRating:   Math.round(stats[0].avg * 10) / 10,
                reviewCount: stats[0].count
            });
        }
        try {
            const home = await Home.findById(booking.home);
            if (home) {
                await notify({
                    userId: home.owner,
                    type: "review_posted",
                    title: "New review received",
                    message: `${req.user.fname} ${req.user.lname} left a ${ratingNum}-star review on ${home.houseName}.`,
                    link: `/homeList/${home._id}`,
                    icon: "general",
                    meta: { homeId: home._id.toString(), bookingId }
                });
            }
        } catch (notifyErr) {
            console.error("New-review notification failed:", notifyErr.message);
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

export const postHostReply = async (req, res, next) => {
    try {
        const { comment } = req.body;
        if (!comment || comment.trim().length < 2) {
            return res.status(400).send("Reply too short");
        }
        const review = await Review.findById(req.params.reviewId).populate("home");
        if (!review) return res.status(404).send("Review not found");
        if (review.home.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        if (review.hostReply && review.hostReply.comment) {
            return res.status(400).send("You have already replied to this review");
        }
        review.hostReply = {
            comment: comment.trim(),
            repliedAt: new Date()
        };
        await review.save();
        try {
            await notify({
                userId: review.guest,
                type: "review_replied",
                title: "The host replied to your review",
                message: `${req.user.fname} ${req.user.lname} replied to your review on ${review.home.houseName}.`,
                link: `/homeList/${review.home._id}`,
                icon: "general",
                meta: { homeId: review.home._id.toString(), reviewId: review._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Host-reply notification failed:", notifyErr.message);
        }
        res.redirect(`/homeList/${review.home._id}`);
    } catch (err) {
        next(err);
    }
};

export const editReview = async (req, res, next) => {
    try {
        const { rating, comment, cleanliness, accuracy, checkin, communication, location, value } = req.body;
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).send("Review not found");
        if (review.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        const hoursSince = (Date.now() - new Date(review.createdAt)) / (1000 * 60 * 60);
        if (hoursSince > 24) {
            return res.status(403).send("Review can only be edited within 24 hours of posting");
        }
        const ratingNum = parseInt(rating, 10);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).send("Rating must be between 1 and 5");
        }
        if (!comment || comment.trim().length < 10) {
            return res.status(400).send("Review must be at least 10 characters");
        }

        const subRatings = { cleanliness, accuracy, checkin, communication, location, value };
        const parsedSubRatings = {};
        for (const [key, val] of Object.entries(subRatings)) {
            const n = parseInt(val, 10);
            if (!n || n < 1 || n > 5) {
                return res.status(400).send(`Please rate "${key}" between 1 and 5`);
            }
            parsedSubRatings[key] = n;
        }

        review.rating  = ratingNum;
        review.comment = comment.trim();
        Object.assign(review, parsedSubRatings);
        await review.save();
        const stats = await Review.aggregate([
            { $match: { home: review.home } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);
        if (stats.length > 0) {
            await Home.findByIdAndUpdate(review.home, {
                avgRating:   Math.round(stats[0].avg * 10) / 10,
                reviewCount: stats[0].count
            });
        }
        res.redirect("/bookings");
    } catch (err) {
        next(err);
    }
};

export const deleteReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).send("Review not found");
        if (review.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send("Forbidden");
        }
        const hoursSince = (Date.now() - new Date(review.createdAt)) / (1000 * 60 * 60);
        if (hoursSince > 24) {
            return res.status(403).send("Review can only be deleted within 24 hours of posting");
        }
        const homeId = review.home;
        await Review.findByIdAndDelete(req.params.reviewId);
        await Booking.findByIdAndUpdate(review.booking, { hasReviewed: false });
        const stats = await Review.aggregate([
            { $match: { home: homeId } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);
        await Home.findByIdAndUpdate(homeId, {
            avgRating:   stats.length > 0 ? Math.round(stats[0].avg * 10) / 10 : 0,
            reviewCount: stats.length > 0 ? stats[0].count : 0
        });
        res.redirect("/bookings");
    } catch (err) {
        next(err);
    }
};
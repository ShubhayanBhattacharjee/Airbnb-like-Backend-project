import Home from '../models/home.js';
import User from '../models/user.js';
import Booking from '../models/booking.js';
import Review from '../models/review.js';
import { getUnavailableHomeIds } from '../utils/availability.js';
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js';
import { ensureHostId } from '../utils/sequence.js';
import { notify } from '../utils/notify.js';

export const getProfile = async (req, res, next) => {
    try {
        const user = req.user;
        let stats = {};
        if (user.role === 'guest') {
            const totalBookings = await Booking.countDocuments({
                guest: user._id
            });
            const completedBookings = await Booking.countDocuments({
                guest: user._id,
                status: 'completed'
            });
            const upcomingBookings = await Booking.countDocuments({
                guest: user._id,
                status: 'upcoming'
            });
            stats = { totalBookings, completedBookings, upcomingBookings };
        } else if (user.role === 'host') {
            const totalListings = await Home.countDocuments({
                owner: user._id
            });
            const homes = await Home.find({ owner: user._id });
            const totalEarnings = await Booking.aggregate([
                {
                    $match: {
                        home: { $in: homes.map(h => h._id) },
                        paymentStatus: 'paid'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalPrice' }
                    }
                }
            ]);
            const totalGuests = await Booking.countDocuments({
                home: { $in: homes.map(h => h._id) },
                status: { $ne: 'cancelled' }
            });
            stats = {
                totalListings,
                totalEarnings: totalEarnings[0]?.total || 0,
                totalGuests
            };
        }
        res.render('profile', {
            pageTitle: 'My Profile',
            user,
            stats,
            errors: [],
            success: null
        });
    } catch (err) {
        next(err);
    }
};

export const postProfile = async (req, res, next) => {
    try {
        const { fname, lname, mname, bio, location, country, phone, email } = req.body;
        const user = await User.findById(req.user._id);
        if (!fname || fname.trim().length < 2) {
            return res.render('profile', {
                pageTitle: 'My Profile',
                user: req.user,
                stats: {},
                errors: ['First name must be at least 2 characters'],
                success: null
            });
        }
        const trimmedEmail = email?.trim().toLowerCase();
        if (trimmedEmail && trimmedEmail !== user.email) {
            const existing = await User.findOne({ email: trimmedEmail });
            if (existing) {
                return res.render('profile', {
                    pageTitle: 'My Profile',
                    user: req.user,
                    stats: {},
                    errors: ['That email is already in use by another account'],
                    success: null
                });
            }
            user.email = trimmedEmail;
        }
        user.fname    = fname.trim();
        user.lname    = lname.trim();
        user.mname    = mname?.trim() || '';
        user.bio      = bio?.trim() || '';
        user.location = location?.trim() || '';
        user.country  = country?.trim() || '';
        user.phone    = phone?.trim() || '';
        if (req.file) {
            try {
                user.profileImage = await uploadToCloudinary(
                    req.file.buffer,
                    'homestays/profiles',
                    300, 300
                );
            } catch (uploadErr) {
                return res.render('profile', {
                    pageTitle: 'My Profile',
                    user: req.user,
                    stats: {},
                    errors: [uploadErr.message],
                    success: null
                });
            }
        }
        await user.save();
        try {
            await notify({
                userId: user._id,
                type: "profile_updated",
                title: "Profile updated",
                message: "Your account details were updated successfully.",
                link: "/profile",
                icon: "user"
            });
        } catch (notifyErr) {
            console.error("Profile update notification failed:", notifyErr.message);
        }
        res.render('profile', {
            pageTitle: 'My Profile',
            user,
            stats: {},
            errors: [],
            success: 'Profile updated successfully!'
        });
    } catch (err) {
        next(err);
    }
};

export const postBecomeHost = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.redirect('/login');
        }
        if (user.role !== 'guest') {
            return res.redirect('/profile');
        }
        user.role = 'host';
        await ensureHostId(user);
        await user.save();
        res.render('profile', {
            pageTitle: 'My Profile',
            user,
            stats: {},
            errors: [],
            success: `You're now a host! Your host ID is ${user.hostId}.`
        });
    } catch (err) {
        next(err);
    }
};

export const deleteProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.redirect("/login");
        }
        if (user.role === "guest") {
            const upcoming = await Booking.countDocuments({
                guest: user._id,
                status: "upcoming"
            });
            if (upcoming > 0) {
                return res.render("profile", {
                    pageTitle: "My Profile",
                    user,
                    stats: {},
                    success: null,
                    errors: [
                        "You cannot delete your account while you have upcoming bookings."
                    ]
                });
            }
            await Review.deleteMany({
                author: user._id
            });
            await Booking.deleteMany({
                guest: user._id
            });
        }
        if (user.role === "host") {
            const homes = await Home.find({
                owner: user._id
            });
            const homeIds = homes.map(h => h._id);
            const futureBookings = await Booking.countDocuments({
                home: { $in: homeIds },
                status: "upcoming"
            });
            if (futureBookings > 0) {
                return res.render("profile", {
                    pageTitle: "My Profile",
                    user,
                    stats: {},
                    success: null,
                    errors: [
                        "Cancel or complete all upcoming bookings before deleting your account."
                    ]
                });
            }
            await Review.deleteMany({
                home: { $in: homeIds }
            });
            await Booking.deleteMany({
                home: { $in: homeIds }
            });
            await Home.deleteMany({
                owner: user._id
            });
        }
        await User.findByIdAndDelete(user._id);
        req.logout(err => {
            if (err) return next(err);
            req.session.destroy(() => {
                res.clearCookie("connect.sid");
                res.redirect("/");
            });
        });
    } catch (err) {
        next(err);
    }
};

export const profileController = { getProfile,postProfile,postBecomeHost,deleteProfile };

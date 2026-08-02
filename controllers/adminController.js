import bcrypt  from "bcryptjs";
import PDFDocument from "pdfkit";
import User    from "../models/user.js";
import Home    from "../models/home.js";
import Booking from "../models/booking.js";
import Review  from "../models/review.js";
import AuditLog from "../models/auditLog.js";
import Issue from "../models/issue.js";
import { hostPayoutSentTemplate } from "../utils/emailTemplates.js";
import { runAutoPayouts } from "../utils/payouts.js";
import { logAudit } from "../utils/auditLog.js";
import { notify } from "../utils/notify.js";
import { getRazorpay } from "./bookingController.js"; // add to top imports

export const getDashboard = async (req, res, next) => {
    try {
        const [
            totalUsers, totalHosts, totalGuests,
            totalHomes, totalBookings, totalReviews,
            revenue, issuesOpen, auditLogs, bannedUsers,
            recentBookings, recentUsers
        ] = await Promise.all([
            User.countDocuments({ role: { $ne: 'admin' } }),
            User.countDocuments({ role: 'host' }),
            User.countDocuments({ role: 'guest' }),
            Home.countDocuments(),
            Booking.countDocuments(),
            Review.countDocuments(),
            Booking.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } }
            ]),
            Issue.countDocuments({ status: 'open' }), 
            AuditLog.countDocuments(),
            User.countDocuments({ isBanned: true }),
            Booking.find({ paymentStatus: 'paid' })
                .populate('home', 'houseName')
                .populate('guest', 'fname lname email')
                .sort({ createdAt: -1 }).limit(5),
            User.find({ role: { $ne: 'admin' } })
                .sort({ _id: -1 }).limit(5)
        ]);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyRaw = await Booking.aggregate([
            {
                $match: {
                    paymentStatus: "paid",
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year:  { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    bookings: { $sum: 1 },
                    revenue:  { $sum: "$totalPrice" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const monthlyData = monthlyRaw.map(m => ({
            label:    monthNames[m._id.month - 1] + " " + m._id.year,
            bookings: m.bookings,
            revenue:  m.revenue
        }));
        res.render('admin/dashboard', {
            pageTitle: 'Admin Dashboard',
            stats: {
                totalUsers, totalHosts, totalGuests,
                totalHomes, totalBookings, totalReviews,
                revenue: revenue[0]?.total || 0,
                issuesOpen, auditLogs, bannedUsers 
            },
            recentBookings,
            recentUsers,
            monthlyData 
        });
    } catch (err) { next(err); }
};

export const getUsers = async (req, res, next) => {
    try {
        const { role, search, banned, page: p } = req.query;
        const filter = { role: { $ne: 'admin' } };
        if (role && role !== 'all') filter.role = role;
        if (banned === 'true') filter.isBanned = true;
        if (search) filter.$or = [
            { fname: { $regex: search, $options: 'i' } },
            { lname: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
        const PAGE = 10;
        const page = Math.max(1, parseInt(p) || 1);
        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .sort({ _id: -1 })
            .skip((page - 1) * PAGE)
            .limit(PAGE);
        res.render('admin/users', {
            pageTitle: 'Manage Users', users,
            total, page, totalPages: Math.ceil(total / PAGE),
            filters: { role: role || 'all', search: search || '', banned: banned || '' }
        });
    } catch (err) { next(err); }
};

export const banUser = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.id);          
        if (!user) return res.status(404).send('User not found');
        await User.findByIdAndUpdate(req.params.id, {
            isBanned: true,
            banReason: reason || 'Violated terms of service'
        });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "user_banned", targetType: "User", targetId: user._id,
            details: `Banned ${user.email} — reason: ${reason || 'Violated terms of service'}`,
            ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: user._id,
                type: "account_banned",
                title: "Your account has been suspended",
                message: `Your account was suspended by an admin. Reason: ${reason || 'Violated terms of service'}`,
                link: "/profile",
                icon: "user",
                meta: { reason: reason || 'Violated terms of service' }
            });
        } catch (notifyErr) {
            console.error("Ban notification failed:", notifyErr.message);
        }
        res.redirect('/admin/users');
    } catch (err) { next(err); }
};

export const unbanUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');
        await User.findByIdAndUpdate(req.params.id, { isBanned: false, banReason: '' });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "user_unbanned", targetType: "User", targetId: user._id,
            details: `Unbanned ${user.email}`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: user._id,
                type: "account_unbanned",
                title: "Your account has been reinstated",
                message: "Your account suspension was lifted by an admin. You're all set.",
                link: "/profile",
                icon: "user"
            });
        } catch (notifyErr) {
            console.error("Unban notification failed:", notifyErr.message);
        }
        res.redirect('/admin/users');
    } catch (err) { next(err); }
};

export const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role === 'admin') return res.status(403).send('Forbidden');
        const homes = await Home.find({ owner: user._id });
        for (const home of homes) {
            await Booking.deleteMany({ home: home._id });
            await Review.deleteMany({ home: home._id });
            await home.deleteOne();
        }
        await Booking.deleteMany({ guest: user._id });
        const email = user.email;
        await user.deleteOne();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "user_deleted", targetType: "User", targetId: user._id,
            details: `Deleted ${email} and all associated homes/bookings`, ip: req.ip
        });
        res.redirect('/admin/users');
    } catch (err) { next(err); }
};


export const changeUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!['guest', 'host'].includes(role)) return res.status(400).send('Invalid role');
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');
        const oldRole = user.role;
        await User.findByIdAndUpdate(req.params.id, { role });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "user_role_changed", targetType: "User", targetId: user._id,
            details: `${user.email}: ${oldRole} → ${role}`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: user._id,
                type: "role_changed",
                title: "Your account role has changed",
                message: `An admin changed your account role from ${oldRole} to ${role}.`,
                link: role === 'host' ? "/host/dashboard" : "/homeList",
                icon: "user"
            });
        } catch (notifyErr) {
            console.error("Role-change notification failed:", notifyErr.message);
        }
        res.redirect('/admin/users');
    } catch (err) { next(err); }
};


export const getListings = async (req, res, next) => {
    try {
        const { search, flagged, hidden, page: p } = req.query;
        const filter = {};
        if (flagged === 'true') filter.isFlagged = true;
        if (hidden  === 'true') filter.isHidden  = true;
        if (search) filter.$or = [
            { houseName: { $regex: search, $options: 'i' } },
            { location:  { $regex: search, $options: 'i' } }
        ];
        const PAGE = 10;
        const page = Math.max(1, parseInt(p) || 1);
        const total = await Home.countDocuments(filter);
        const listings = await Home.find(filter)
            .populate('owner', 'fname lname email')
            .sort({ _id: -1 })
            .skip((page - 1) * PAGE)
            .limit(PAGE);
        res.render('admin/listings', {
            pageTitle: 'Manage Listings', listings,
            total, page, totalPages: Math.ceil(total / PAGE),
            filters: { search: search || '', flagged: flagged || '', hidden: hidden || '' }
        });
    } catch (err) { next(err); }
};

export const flagListing = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        await Home.findByIdAndUpdate(req.params.id, {
            isFlagged: true,
            flagReason: reason || 'Flagged by admin'
        });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "listing_flagged", targetType: "Home", targetId: home._id,
            details: `Flagged "${home.houseName}" — reason: ${reason || 'Flagged by admin'}`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: home.owner,
                type: "listing_flagged",
                title: "Your listing was flagged",
                message: `${home.houseName} was flagged by an admin. Reason: ${reason || 'Flagged by admin'}`,
                link: `/host/hostHomeList`,
                icon: "home",
                meta: { homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Flag-listing notification failed:", notifyErr.message);
        }
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const unflagListing = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        await Home.findByIdAndUpdate(req.params.id, { isFlagged: false, flagReason: '' });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "listing_unflagged", targetType: "Home", targetId: home._id,
            details: `Unflagged "${home.houseName}"`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: home.owner,
                type: "listing_unflagged",
                title: "Your listing flag was cleared",
                message: `${home.houseName} is no longer flagged.`,
                link: `/host/hostHomeList`,
                icon: "home",
                meta: { homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Unflag-listing notification failed:", notifyErr.message);
        }
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};


export const hideListing = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        await Home.findByIdAndUpdate(req.params.id, { isHidden: true });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "listing_hidden", targetType: "Home", targetId: home._id,
            details: `Hid "${home.houseName}" from search`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: home.owner,
                type: "listing_hidden",
                title: "Your listing was hidden",
                message: `${home.houseName} was hidden from search by an admin.`,
                link: `/host/hostHomeList`,
                icon: "home",
                meta: { homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Hide-listing notification failed:", notifyErr.message);
        }
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const unhideListing = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        await Home.findByIdAndUpdate(req.params.id, { isHidden: false });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "listing_unhidden", targetType: "Home", targetId: home._id,
            details: `Unhid "${home.houseName}"`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: home.owner,
                type: "listing_unhidden",
                title: "Your listing is visible again",
                message: `${home.houseName} is now visible in search again.`,
                link: `/host/hostHomeList`,
                icon: "home",
                meta: { homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Unhide-listing notification failed:", notifyErr.message);
        }
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const deleteListing = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        await Booking.deleteMany({ home: req.params.id });
        await Review.deleteMany({ home: req.params.id });
        const ownerId = home.owner;          // NEW — grab before delete
        const houseName = home.houseName;    // NEW
        await Home.findByIdAndDelete(req.params.id);
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "listing_deleted", targetType: "Home", targetId: home._id,
            details: `Deleted "${home.houseName}" and all associated bookings/reviews`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: ownerId,
                type: "listing_removed",
                title: "Your listing was removed",
                message: `${houseName} was removed by an admin, along with its bookings and reviews.`,
                link: `/host/hostHomeList`,
                icon: "home"
            });
        } catch (notifyErr) {
            console.error("Delete-listing notification failed:", notifyErr.message);
        }
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const getBookings = async (req, res, next) => {
    try {
        const { status, page: p } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        const PAGE = 10;
        const page = Math.max(1, parseInt(p) || 1);
        const total = await Booking.countDocuments(filter);
        const bookings = await Booking.find(filter)
            .populate('home',  'houseName location')
            .populate('guest', 'fname lname email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE)
            .limit(PAGE);
        res.render('admin/bookings', {
            pageTitle: 'Manage Bookings', bookings,
            total, page, totalPages: Math.ceil(total / PAGE),
            filters: { status: status || 'all' }
        });
    } catch (err) { next(err); }
};

export const getReviews = async (req, res, next) => {
    try {
        const { flagged, page: p } = req.query;
        const filter = {};
        if (flagged === 'true') filter.isFlagged = true;
        const PAGE = 10;
        const page = Math.max(1, parseInt(p) || 1);
        const total = await Review.countDocuments(filter);
        const reviews = await Review.find(filter)
            .populate('guest', 'fname lname email')
            .populate('home',  'houseName')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE)
            .limit(PAGE);
        res.render('admin/reviews', {
            pageTitle: 'Manage Reviews', reviews,
            total, page, totalPages: Math.ceil(total / PAGE),
            filters: { flagged: flagged || '' }
        });
    } catch (err) { next(err); }
};

export const deleteReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).send('Not found');
        await Booking.findByIdAndUpdate(review.booking, { hasReviewed: false });
        const homeId = review.home;
        const guestId = review.guest;   // NEW — grab before delete
        await review.deleteOne();
        const stats = await Review.aggregate([
            { $match: { home: homeId } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        await Home.findByIdAndUpdate(homeId, {
            avgRating:   stats[0]?.avg ? Math.round(stats[0].avg * 10) / 10 : 0,
            reviewCount: stats[0]?.count || 0
        });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "review_deleted", targetType: "Review", targetId: review._id,
            details: `Deleted review on home ${homeId}`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: guestId,
                type: "review_removed",
                title: "Your review was removed",
                message: "A review you posted was removed by an admin for violating our guidelines.",
                link: "/bookings",
                icon: "general"
            });
        } catch (notifyErr) {
            console.error("Delete-review notification failed:", notifyErr.message);
        }
        res.redirect('/admin/reviews');
    } catch (err) { next(err); }
};

export const flagReview = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).send('Review not found');
        await Review.findByIdAndUpdate(req.params.id, {
            isFlagged: true, flagReason: reason || 'Flagged by admin'
        });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "review_flagged", targetType: "Review", targetId: review._id,
            details: `Flagged review — reason: ${reason || 'Flagged by admin'}`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: review.guest,
                type: "review_flagged",
                title: "Your review was flagged",
                message: `A review you posted was flagged for review. Reason: ${reason || 'Flagged by admin'}`,
                link: "/bookings",
                icon: "general"
            });
        } catch (notifyErr) {
            console.error("Flag-review notification failed:", notifyErr.message);
        }
        res.redirect('/admin/reviews');
    } catch (err) { next(err); }
};

export const unflagReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).send('Review not found');
        await Review.findByIdAndUpdate(req.params.id, { isFlagged: false, flagReason: '' });
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "review_unflagged", targetType: "Review", targetId: review._id,
            details: `Unflagged review`, ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: review.guest,
                type: "review_flagged",
                title: "Your review flag was cleared",
                message: "The flag on your review was cleared by an admin.",
                link: "/bookings",
                icon: "general"
            });
        } catch (notifyErr) {
            console.error("Unflag-review notification failed:", notifyErr.message);
        }
        res.redirect('/admin/reviews');
    } catch (err) { next(err); }
};

export const getLogin = (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    res.render('admin/login', { pageTitle: 'Admin Login', error: null });
};

export const postLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, role: 'admin' });
        if (!admin) {
            return res.render('admin/login', { pageTitle: 'Admin Login', error: 'Invalid credentials' });
        }
        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.render('admin/login', { pageTitle: 'Admin Login', error: 'Invalid credentials' });
        }
        req.session.adminId   = admin._id.toString();
        req.session.adminRole = admin.adminRole || 'support';
        res.redirect('/admin/dashboard');
    } catch (err) { next(err); }
};

export const postLogout = (req, res) => {
    req.session.adminId = null;
    res.redirect('/admin/login');
};

export const getPayouts = async (req, res, next) => {
    try {
        const { status, page: p, processed, paid, skipped, checked, error } = req.query;
        const filter = {};
        filter.payoutStatus = (status && status !== 'all') ? status : 'pending';
        const PAGE = 10;
        const page = Math.max(1, parseInt(p) || 1);
        const total = await Booking.countDocuments(filter);
        const bookings = await Booking.find(filter)
            .populate('home', 'houseName location owner')
            .populate({ path: 'home', populate: { path: 'owner', select: 'fname lname email payoutDetails' } })
            .populate('guest', 'fname lname email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE)
            .limit(PAGE);
        const totals = await Booking.aggregate([
            { $match: { payoutStatus: 'pending' } },
            { $group: { _id: null, amount: { $sum: '$payoutAmount' }, count: { $sum: 1 } } }
        ]);
        res.render('admin/payouts', {
            pageTitle: 'Host Payouts', bookings,
            total, page, totalPages: Math.ceil(total / PAGE),
            filters: { status: status || 'pending' },
            pendingTotal: totals[0]?.amount || 0,
            pendingCount: totals[0]?.count || 0,
            processed: processed === '1',
            paidCount: paid || 0,
            skippedCount: skipped || 0,
            checkedCount: checked || 0,
            payoutError: error || null
        });
    } catch (err) { next(err); }
};

export const markPayoutPaid = async (req, res, next) => {
    try {
        const { reference, method } = req.body;
        const booking = await Booking.findById(req.params.id).populate('home', 'houseName owner'); // CHANGED
        if (!booking) return res.status(404).send('Booking not found');
        if (booking.payoutStatus !== 'pending') return res.redirect('/admin/payouts');
        booking.payoutStatus    = 'paid';
        booking.payoutReference = reference || '';
        booking.payoutMethod    = method || '';
        booking.payoutDate      = new Date();
        await booking.save();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_marked_paid", targetType: "Booking", targetId: booking._id,
            details: `Marked ₹${booking.payoutAmount} paid via ${method || 'unspecified'} (ref: ${reference || 'none'})`,
            ip: req.ip
        });
        try {
            if (booking.home) {
                await notify({
                    userId: booking.home.owner,
                    type: "host_payout_paid",
                    title: "Payout received",
                    message: `₹${booking.payoutAmount} was paid out for your booking at ${booking.home.houseName}.`,
                    link: "/host/dashboard",
                    icon: "payout",
                    meta: { bookingId: booking._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Payout notification failed:", notifyErr.message);
        }
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};


export const markPayoutFailed = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('home', 'houseName owner'); // CHANGED
        if (!booking) return res.status(404).send('Booking not found');
        booking.payoutStatus = 'failed';
        await booking.save();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_marked_failed", targetType: "Booking", targetId: booking._id,
            details: `Marked payout of ₹${booking.payoutAmount} as failed`, ip: req.ip
        });
        try {
            if (booking.home) {
                await notify({
                    userId: booking.home.owner,
                    type: "host_payout_failed",
                    title: "Payout failed",
                    message: `Your payout of ₹${booking.payoutAmount} for ${booking.home.houseName} couldn't be processed. Please check your payout details.`,
                    link: "/host/dashboard",
                    icon: "payout",
                    meta: { bookingId: booking._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Payout-failed notification failed:", notifyErr.message);
        }
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

export const processDuePayouts = async (req, res, next) => {
    try {
        const { paid, skipped, checked } = await runAutoPayouts();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_batch_processed", targetType: "Booking", targetId: null,   
            details: `Processed due payouts — ${paid} paid, ${skipped} skipped, ${checked} checked`,
            ip: req.ip
        });
        res.redirect(`/admin/payouts?processed=1&paid=${paid}&skipped=${skipped}&checked=${checked}`);
    } catch (err) { next(err); }
};

export const retryPayout = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({ path: 'home', populate: { path: 'owner' } });
        if (!booking) return res.status(404).send('Booking not found');
        if (booking.payoutStatus !== 'failed') return res.redirect('/admin/payouts');
        const host = booking.home && booking.home.owner;
        if (!host || !host.payoutDetails || !host.payoutDetails.method) {
            return res.redirect('/admin/payouts?error=host-missing-payout-details');
        }
        booking.payoutStatus = 'pending';
        await booking.save();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_retry", targetType: "Booking", targetId: booking._id,
            details: `Requeued failed payout of ₹${booking.payoutAmount}`, ip: req.ip
        });
        try {
            await notify({
                userId: host._id,
                type: "host_payout_retry_queued",
                title: "Payout retry queued",
                message: `Your payout of ₹${booking.payoutAmount} for ${booking.home.houseName} has been requeued.`,
                link: "/host/dashboard",
                icon: "payout",
                meta: { bookingId: booking._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Retry-payout notification failed:", notifyErr.message);
        }
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

export const getAuditLog = async (req, res, next) => {
    try {
        const { action, page: p } = req.query;
        const filter = {};
        if (action && action !== 'all') filter.action = action;
        const PAGE = 25;
        const page = Math.max(1, parseInt(p) || 1);
        const total = await AuditLog.countDocuments(filter);
        const logs = await AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE)
            .limit(PAGE);
        const actorIds = logs.map(l => l.actorId).filter(Boolean);
        const actors = await User.find({ _id: { $in: actorIds } }).select('fname lname email');
        const actorMap = {};
        actors.forEach(a => { actorMap[a._id.toString()] = a; });

        res.render('admin/auditLog', {
            pageTitle: 'Audit Log', logs, actorMap,
            total, page, totalPages: Math.ceil(total / PAGE),
            filters: { action: action || 'all' }
        });
    } catch (err) { next(err); }
};

export const setListingCommission = async (req, res, next) => {
    try {
        const { commissionOverridePercent } = req.body;
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        const val = commissionOverridePercent === '' ? null : parseFloat(commissionOverridePercent);
        home.commissionOverridePercent = val;
        await home.save();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "commission_override_set", targetType: "Home", targetId: home._id,
            details: `Set commission override to ${val === null ? 'default' : val + '%'} for "${home.houseName}"`,
            ip: req.ip
        });
        // NEW
        try {
            await notify({
                userId: home.owner,
                type: "commission_updated",
                title: "Commission rate updated",
                message: `Your commission rate for ${home.houseName} was set to ${val === null ? 'the platform default' : val + '%'} by an admin.`,
                link: `/host/hostHomeList`,
                icon: "home",
                meta: { homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Commission-update notification failed:", notifyErr.message);
        }
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const bulkMarkPayoutsPaid = async (req, res, next) => {
    try {
        const { bookingIds, method } = req.body;
        const ids = Array.isArray(bookingIds) ? bookingIds : [bookingIds].filter(Boolean);
        if (ids.length === 0) return res.redirect('/admin/payouts');

        const bookings = await Booking.find({ _id: { $in: ids }, payoutStatus: 'pending' })
            .populate('home', 'houseName owner'); // CHANGED
        for (const booking of bookings) {
            booking.payoutStatus    = 'paid';
            booking.payoutMethod    = method || '';
            booking.payoutReference = `BULK-${Date.now()}`;
            booking.payoutDate      = new Date();
            await booking.save();
            try {
                if (booking.home) {
                    await notify({
                        userId: booking.home.owner,
                        type: "host_payout_paid",
                        title: "Payout received",
                        message: `₹${booking.payoutAmount} was paid out for your booking at ${booking.home.houseName}.`,
                        link: "/host/dashboard",
                        icon: "payout",
                        meta: { bookingId: booking._id.toString() }
                    });
                }
            } catch (notifyErr) {
                console.error("Bulk payout notification failed:", notifyErr.message);
            }
        }
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_bulk_marked_paid", targetType: "Booking",
            details: `Bulk-marked ${bookings.length} payout(s) as paid via ${method || 'unspecified'}`,
            ip: req.ip
        });
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

export const bulkRetryPayouts = async (req, res, next) => {
    try {
        const { bookingIds } = req.body;
        const ids = Array.isArray(bookingIds) ? bookingIds : [bookingIds].filter(Boolean);
        if (ids.length === 0) return res.redirect('/admin/payouts');

        // CHANGED — fetch the docs (with home/owner) instead of a bare updateMany,
        // so we can notify each host individually
        const bookings = await Booking.find({ _id: { $in: ids }, payoutStatus: 'failed' })
            .populate('home', 'houseName owner');
        for (const booking of bookings) {
            booking.payoutStatus = 'pending';
            await booking.save();
            try {
                if (booking.home) {
                    await notify({
                        userId: booking.home.owner,
                        type: "host_payout_retry_queued",
                        title: "Payout retry queued",
                        message: `Your payout of ₹${booking.payoutAmount} for ${booking.home.houseName} has been requeued.`,
                        link: "/host/dashboard",
                        icon: "payout",
                        meta: { bookingId: booking._id.toString() }
                    });
                }
            } catch (notifyErr) {
                console.error("Bulk retry-payout notification failed:", notifyErr.message);
            }
        }
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_bulk_retry", targetType: "Booking",
            details: `Bulk-requeued ${bookings.length} failed payout(s)`,
            ip: req.ip
        });
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

function sendReportCsv(res, bookings, totals, period) {
    const esc = (v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Booking ID","Property","Date","Gross Amount","Platform Commission","Payout Amount","Payout Status"];
    const rows = bookings.map(b => [
        b._id.toString(), b.home?.houseName || "", new Date(b.createdAt).toISOString().slice(0,10),
        b.totalPrice, b.platformCommission, b.payoutAmount, b.payoutStatus
    ]);
    const summary = [
        [], ["SUMMARY"],
        ["Gross Revenue", totals.grossRevenue],
        ["Platform Commission Earned", totals.commissionEarned],
        ["Payouts Made", totals.payoutsMade],
        ["Payouts Pending", totals.payoutsPending]
    ];
    const csv = [header, ...rows, ...summary].map(r => r.map(esc).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="financial-report-${period}.csv"`);
    res.send(csv);
}

function sendReportPdf(res, bookings, totals, period) {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="financial-report-${period}.pdf"`);
    doc.pipe(res);

    const GOLD = "#C9A96E", DARK = "#1a1208", GRAY = "#6b7280", LIGHT = "#f3f4f6", BORDER = "#e5e7eb";
    const PAGE_W = 595.28, MARGIN = 50, CONTENT_W = PAGE_W - MARGIN * 2;

    doc.rect(0, 0, PAGE_W, 90).fill(DARK);
    doc.fillColor(GOLD).fontSize(22).font("Helvetica-Bold").text("ROOVIA", MARGIN, 26);
    doc.fillColor("#fff").fontSize(15).font("Helvetica-Bold").text("Financial Report", MARGIN, 54);
    doc.fillColor("#c9c9c9").fontSize(9).font("Helvetica")
       .text(`Period: ${period === "all-time" ? "All time" : period}`, 0, 30, { align: "right", width: PAGE_W - MARGIN });

    let y = 116;

    // Summary cards, 2x2 grid
    const cardW = (CONTENT_W - 16) / 2;
    const cardH = 56;
    const cards = [
        ["Gross Revenue", totals.grossRevenue, "#166534"],
        ["Commission Earned", totals.commissionEarned, DARK],
        ["Payouts Made", totals.payoutsMade, "#0369a1"],
        ["Payouts Pending", totals.payoutsPending, "#92400e"]
    ];
    cards.forEach((c, i) => {
        const cx = MARGIN + (i % 2) * (cardW + 16);
        const cy = y + Math.floor(i / 2) * (cardH + 12);
        doc.roundedRect(cx, cy, cardW, cardH, 6).fillAndStroke(LIGHT, BORDER);
        doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(c[0].toUpperCase(), cx + 14, cy + 12);
        doc.fillColor(c[2]).fontSize(15).font("Helvetica-Bold").text(`Rs ${c[1].toLocaleString("en-IN")}`, cx + 14, cy + 28);
    });

    y += cardH * 2 + 12 + 30;

    // Bookings table
    doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text(`Bookings (${bookings.length})`, MARGIN, y);
    y += 20;

    const cols = [
        { label: "Date", x: MARGIN, w: 70 },
        { label: "Property", x: MARGIN + 70, w: 165 },
        { label: "Gross", x: MARGIN + 235, w: 80 },
        { label: "Commission", x: MARGIN + 315, w: 90 },
        { label: "Payout", x: MARGIN + 405, w: 70 },
        { label: "Status", x: MARGIN + 475, w: 70 }
    ];
    const drawHeader = () => {
        doc.rect(MARGIN, y, CONTENT_W, 20).fill(DARK);
        doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
        cols.forEach(c => doc.text(c.label.toUpperCase(), c.x + 8, y + 6, { width: c.w - 8 }));
        y += 20;
    };
    drawHeader();

    doc.font("Helvetica").fontSize(8);
    bookings.forEach((b, i) => {
        if (y > 760) { doc.addPage(); y = 50; drawHeader(); }
        if (i % 2 === 0) doc.rect(MARGIN, y, CONTENT_W, 18).fill(LIGHT);
        doc.fillColor(DARK);
        doc.text(new Date(b.createdAt).toLocaleDateString("en-IN"), cols[0].x + 8, y + 5, { width: cols[0].w - 8 });
        doc.text(b.home?.houseName || "-", cols[1].x + 8, y + 5, { width: cols[1].w - 8, ellipsis: true });
        doc.text(`Rs ${b.totalPrice.toLocaleString("en-IN")}`, cols[2].x + 8, y + 5, { width: cols[2].w - 8 });
        doc.text(`Rs ${(b.platformCommission || 0).toLocaleString("en-IN")}`, cols[3].x + 8, y + 5, { width: cols[3].w - 8 });
        doc.text(`Rs ${b.payoutAmount.toLocaleString("en-IN")}`, cols[4].x + 8, y + 5, { width: cols[4].w - 8 });
        doc.text(b.payoutStatus, cols[5].x + 8, y + 5, { width: cols[5].w - 8 });
        y += 18;
    });

    // Page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(GRAY).fontSize(8).font("Helvetica")
           .text(`Page ${i + 1} of ${range.count}`, MARGIN, 800, { width: CONTENT_W, align: "center" });
    }

    doc.end();
}
export const exportFinancialReport = async (req, res, next) => {
    try {
        const { year, format } = req.query;
        const filter = { paymentStatus: "paid" };
        if (year && !isNaN(parseInt(year, 10))) {
            const y = parseInt(year, 10);
            filter.createdAt = {
                $gte: new Date(`${y}-01-01T00:00:00.000Z`),
                $lt:  new Date(`${y + 1}-01-01T00:00:00.000Z`)
            };
        }
        const bookings = await Booking.find(filter).populate("home", "houseName").sort({ createdAt: 1 });
        const period = year ? String(year) : "all-time";

        const totals = bookings.reduce((acc, b) => {
            acc.grossRevenue += b.totalPrice;
            acc.commissionEarned += b.platformCommission || 0;
            acc.payoutsMade += (b.payoutStatus === "paid" ? b.payoutAmount : 0);
            acc.payoutsPending += (b.payoutStatus === "pending" ? b.payoutAmount : 0);
            return acc;
        }, { grossRevenue: 0, commissionEarned: 0, payoutsMade: 0, payoutsPending: 0 });

        if (format === "pdf") return sendReportPdf(res, bookings, totals, period);
        return sendReportCsv(res, bookings, totals, period);
    } catch (err) { next(err); }
};

export const confirmHostRepayment = async (req, res, next) => {
    try {
        const { reference } = req.body;
        const booking = await Booking.findById(req.params.id).populate('home').populate('guest');
        if (!booking) return res.status(404).send('Booking not found');
        if (booking.hostRepaymentStatus !== 'pending' && booking.hostRepaymentStatus !== 'overdue') {
            return res.redirect('/admin/payouts');
        }
        if (booking.refundAmount > 0 && booking.razorpayPaymentId) {
            try {
                const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
                    amount: booking.refundAmount * 100, speed: "normal",
                    notes: { reason: `Host repaid ₹${booking.hostRepaymentAmount}, releasing guest refund` }
                });
                booking.razorpayRefundId = refund.id;
                booking.refundStatus = "initiated";
            } catch (e) {
                booking.refundStatus = "failed";
            }
        }
        booking.hostRepaymentStatus     = "paid";
        booking.hostRepaymentReference  = reference || '';
        booking.hostRepaymentConfirmedAt = new Date();
        await booking.save();

        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "host_repayment_confirmed", targetType: "Booking", targetId: booking._id,
            details: `Confirmed ₹${booking.hostRepaymentAmount} repaid, refunded guest ₹${booking.refundAmount}`,
            ip: req.ip
        });

        if (booking.guest) {
            await notify({
                userId: booking.guest._id, type: "refund_processed", title: "Your refund is on its way",
                message: `₹${booking.refundAmount} has been refunded for your cancelled booking.`,
                link: "/bookings", icon: "refund", meta: { bookingId: booking._id.toString() }
            });
        }
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

export const adminController = {getDashboard, getUsers, banUser, unbanUser, deleteUser, changeUserRole,getListings, flagListing, unflagListing, hideListing, unhideListing, deleteListing,getBookings,getReviews, deleteReview, flagReview, unflagReview,getLogin, postLogin, postLogout,markPayoutPaid, markPayoutFailed, getPayouts,processDuePayouts, retryPayout, getAuditLog, setListingCommission, bulkMarkPayoutsPaid, bulkRetryPayouts,
exportFinancialReport,confirmHostRepayment};
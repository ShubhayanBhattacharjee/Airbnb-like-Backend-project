import bcrypt  from "bcryptjs";
import PDFDocument from "pdfkit";
import User    from "../models/user.js";
import Home    from "../models/home.js";
import Booking from "../models/booking.js";
import Review  from "../models/review.js";
import AuditLog from "../models/auditLog.js";
import { hostPayoutSentTemplate } from "../utils/emailTemplates.js";
import { runAutoPayouts } from "../utils/payouts.js";
import { logAudit } from "../utils/auditLog.js";

export const getDashboard = async (req, res, next) => {
    try {
        const [
            totalUsers, totalHosts, totalGuests,
            totalHomes, totalBookings, totalReviews,
            revenue, flaggedHomes, flaggedReviews, bannedUsers,
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
            Home.countDocuments({ isFlagged: true }),
            Review.countDocuments({ isFlagged: true }),
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
                flaggedHomes, flaggedReviews, bannedUsers
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
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const deleteListing = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.id);
        if (!home) return res.status(404).send('Listing not found');
        await Booking.deleteMany({ home: req.params.id });
        await Review.deleteMany({ home: req.params.id });
        await Home.findByIdAndDelete(req.params.id);
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "listing_deleted", targetType: "Home", targetId: home._id,
            details: `Deleted "${home.houseName}" and all associated bookings/reviews`, ip: req.ip
        });
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
        const booking = await Booking.findById(req.params.id);
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
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};


export const markPayoutFailed = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).send('Booking not found');
        booking.payoutStatus = 'failed';
        await booking.save();
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_marked_failed", targetType: "Booking", targetId: booking._id,
            details: `Marked payout of ₹${booking.payoutAmount} as failed`, ip: req.ip
        });
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
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const bulkMarkPayoutsPaid = async (req, res, next) => {
    try {
        const { bookingIds, method } = req.body;
        const ids = Array.isArray(bookingIds) ? bookingIds : [bookingIds].filter(Boolean);
        if (ids.length === 0) return res.redirect('/admin/payouts');

        const bookings = await Booking.find({ _id: { $in: ids }, payoutStatus: 'pending' });
        for (const booking of bookings) {
            booking.payoutStatus    = 'paid';
            booking.payoutMethod    = method || '';
            booking.payoutReference = `BULK-${Date.now()}`;
            booking.payoutDate      = new Date();
            await booking.save();
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

        const result = await Booking.updateMany(
            { _id: { $in: ids }, payoutStatus: 'failed' },
            { $set: { payoutStatus: 'pending' } }
        );
        await logAudit({
            actorType: "admin", actorId: req.session.adminId,
            action: "payout_bulk_retry", targetType: "Booking",
            details: `Bulk-requeued ${result.modifiedCount} failed payout(s)`,
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
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="financial-report-${period}.pdf"`);
    doc.pipe(res);

    doc.fillColor("#C9A96E").fontSize(20).font("Helvetica-Bold").text("HomeStays");
    doc.fillColor("#1a1208").fontSize(15).font("Helvetica-Bold").text("Financial Report");
    doc.fontSize(10).font("Helvetica").fillColor("#444").text(`Period: ${period === "all-time" ? "All time" : period}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1208").text("Summary");
    doc.font("Helvetica").fontSize(10).fillColor("#444")
       .text(`Gross Revenue: ₹${totals.grossRevenue.toLocaleString("en-IN")}`)
       .text(`Platform Commission Earned: ₹${totals.commissionEarned.toLocaleString("en-IN")}`)
       .text(`Payouts Made: ₹${totals.payoutsMade.toLocaleString("en-IN")}`)
       .text(`Payouts Pending: ₹${totals.payoutsPending.toLocaleString("en-IN")}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1208").text(`Bookings (${bookings.length})`);
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(8);
    bookings.forEach(b => {
        if (doc.y > 760) doc.addPage();
        doc.text(`${new Date(b.createdAt).toLocaleDateString("en-IN")}  ${b.home?.houseName || "-"}  ₹${b.totalPrice}  (commission ₹${b.platformCommission}, payout ${b.payoutStatus})`);
    });

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



export const adminController = {getDashboard, getUsers, banUser, unbanUser, deleteUser, changeUserRole,getListings, flagListing, unflagListing, hideListing, unhideListing, deleteListing,getBookings,getReviews, deleteReview, flagReview, unflagReview,getLogin, postLogin, postLogout,markPayoutPaid, markPayoutFailed, getPayouts,processDuePayouts, retryPayout, getAuditLog, setListingCommission, bulkMarkPayoutsPaid, bulkRetryPayouts,
exportFinancialReport};
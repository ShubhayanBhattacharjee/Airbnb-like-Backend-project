import User    from "../models/user.js";
import Home    from "../models/home.js";
import Booking from "../models/booking.js";
import Review  from "../models/review.js";
import bcrypt  from "bcryptjs";

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
        await User.findByIdAndUpdate(req.params.id, {
            isBanned: true,
            banReason: reason || 'Violated terms of service'
        });
        res.redirect('/admin/users');
    } catch (err) { next(err); }
};

export const unbanUser = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { isBanned: false, banReason: '' });
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
        await user.deleteOne();
        res.redirect('/admin/users');
    } catch (err) { next(err); }
};

export const changeUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!['guest', 'host'].includes(role)) return res.status(400).send('Invalid role');
        await User.findByIdAndUpdate(req.params.id, { role });
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
        await Home.findByIdAndUpdate(req.params.id, {
            isFlagged: true,
            flagReason: reason || 'Flagged by admin'
        });
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const unflagListing = async (req, res, next) => {
    try {
        await Home.findByIdAndUpdate(req.params.id, { isFlagged: false, flagReason: '' });
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const hideListing = async (req, res, next) => {
    try {
        await Home.findByIdAndUpdate(req.params.id, { isHidden: true });
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const unhideListing = async (req, res, next) => {
    try {
        await Home.findByIdAndUpdate(req.params.id, { isHidden: false });
        res.redirect('/admin/listings');
    } catch (err) { next(err); }
};

export const deleteListing = async (req, res, next) => {
    try {
        await Booking.deleteMany({ home: req.params.id });
        await Review.deleteMany({ home: req.params.id });
        await Home.findByIdAndDelete(req.params.id);
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
        res.redirect('/admin/reviews');
    } catch (err) { next(err); }
};

export const flagReview = async (req, res, next) => {
    try {
        const { reason } = req.body;
        await Review.findByIdAndUpdate(req.params.id, {
            isFlagged: true,
            flagReason: reason || 'Flagged by admin'
        });
        res.redirect('/admin/reviews');
    } catch (err) { next(err); }
};

export const unflagReview = async (req, res, next) => {
    try {
        await Review.findByIdAndUpdate(req.params.id, { isFlagged: false, flagReason: '' });
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
        req.session.adminId = admin._id.toString();
        res.redirect('/admin/dashboard');
    } catch (err) { next(err); }
};

export const postLogout = (req, res) => {
    req.session.adminId = null;
    res.redirect('/admin/login');
};

export const getPayouts = async (req, res, next) => {
    try {
        const { status, page: p } = req.query;
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
            pendingCount: totals[0]?.count || 0
        });
    } catch (err) { next(err); }
};

export const markPayoutPaid = async (req, res, next) => {
    try {
        const { reference, method } = req.body;
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).send('Booking not found');
        if (booking.payoutStatus !== 'pending') {
            return res.redirect('/admin/payouts');
        }
        booking.payoutStatus    = 'paid';
        booking.payoutReference = reference || '';
        booking.payoutMethod    = method || '';
        booking.payoutDate      = new Date();
        await booking.save();
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

export const markPayoutFailed = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).send('Booking not found');
        booking.payoutStatus = 'failed';
        await booking.save();
        res.redirect('/admin/payouts');
    } catch (err) { next(err); }
};

export const adminController = {getDashboard, getUsers, banUser, unbanUser, deleteUser, changeUserRole,getListings, flagListing, unflagListing, hideListing, unhideListing, deleteListing,getBookings,getReviews, deleteReview, flagReview, unflagReview,getLogin, postLogin, postLogout,markPayoutPaid, markPayoutFailed, getPayouts};
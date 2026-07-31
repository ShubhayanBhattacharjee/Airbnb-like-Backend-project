import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import crypto from "crypto";
import Booking from '../models/booking.js';
import Home, { HOME_TYPE_OPTIONS } from '../models/home.js';
import Review from "../models/review.js";
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js';
import { geocodeAddress } from '../utils/geocode.js';
import { buildIcsForHome } from "../utils/icalExport.js";
import { fetchExternalEvents } from "../utils/icalImport.js";
import { verifyPincode } from '../utils/verifyPincode.js';
import { notify } from "../utils/notify.js";
import { cancelBookingAsHost, HOST_CANCEL_REASONS } from "./bookingController.js";

const getaddHome = (req, res, next) => {
    res.render("host/editHome", {
        pageTitle: 'Add Home',
        editing: false,
        homeTypes: HOME_TYPE_OPTIONS,
    });
}

const getEditHome = async (req, res, next) => {
    try {
        const homeId = req.params.homeId;
        if (!mongoose.Types.ObjectId.isValid(homeId)) {
            return res.status(404).send("Invalid Home ID");
        }
        const home = await Home.findOne({
            _id: homeId,
            owner: req.user._id
        });
        if (!home) {
            return res.status(403).send("Forbidden");
        }
        res.render("host/editHome", {
            home,
            pageTitle: "Edit Home",
            editing: true,
            homeTypes: HOME_TYPE_OPTIONS,
        });
    } catch (err) { next(err); }
}

const HOME_LIST_PAGE_SIZE = 9;

const hostHomeList = async (req, res, next) => {
    try {
        const limit = HOME_LIST_PAGE_SIZE;
        const totalHomes = await Home.countDocuments({ owner: req.user._id });
        const totalPages = Math.max(Math.ceil(totalHomes / limit), 1);

        const requestedPage = parseInt(req.query.page, 10) || 1;
        const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);

        const rows = await Home.find({ owner: req.user._id })
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit);
        res.render("host/hostHomeList", {
            pageTitle: 'Host Home List',
            registeredHomes: rows,
            currentPage,
            totalPages,
            totalHomes,
            hasPrevPage: currentPage > 1,
            hasNextPage: currentPage < totalPages
        });
    } catch (err) {
        next(err);
    }
};

const postaddHome = async (req, res, next) => {
    let { houseName, price, addressLine1, addressLine2, city, state, pincode, country,
          no_of_bedRooms, description, amenities, maxGuests, checkInTime, checkOutTime,
          cancellationPolicy, homeType } = req.body;
    if (!houseName || houseName.trim().length < 3) {
        return res.status(400).send("House name must be at least 3 characters");
    }
    if (price < 100 || price > 1000000) {
        return res.status(400).send("Price must be between ₹100 and ₹10,00,000");
    }
    if (!addressLine1 || !city || !state || !pincode || !country) {
        return res.status(400).send("Building/street, city, state, pincode and country are all required");
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
        return res.status(400).send("Pincode must be a valid 6-digit number");
    }
    const beds = parseInt(no_of_bedRooms, 10);
    if (isNaN(beds) || beds < 1 || beds > 20) {
        return res.status(400).send("Bedrooms must be between 1 and 20");
    }
    price = parseInt(price, 10);
    if (isNaN(price) || price <= 0) {
        return res.status(400).send("Price must be a valid positive number!");
    }
    if (homeType && !HOME_TYPE_OPTIONS.includes(homeType)) {
        return res.status(400).send("Invalid home type selected");
    }
    if (!req.files || req.files.length === 0) {
        return res.status(422).send("No images provided by the host");
    }

    // Run the pincode check and the photo uploads AT THE SAME TIME instead of
    // one after another — they don't depend on each other, so this alone
    // removes several seconds of pure waiting.
    const isIndia = country.trim().toLowerCase() === 'india';
    const [pincodeResult, photosResult] = await Promise.allSettled([
        isIndia ? verifyPincode(pincode) : Promise.resolve(null),
        Promise.all(req.files.map(file => uploadToCloudinary(file.buffer, 'Roovia/listings', 800, 600)))
    ]);

    if (isIndia && pincodeResult.status === 'fulfilled' && pincodeResult.value === false) {
        return res.status(400).send("This pincode doesn't exist. Please check and re-enter.");
    }
    if (photosResult.status === 'rejected') {
        return res.status(422).send(photosResult.reason.message);
    }
    const photos = photosResult.value;

    const location = [addressLine1, addressLine2, city, state, pincode, country]
        .map(p => p && p.trim())
        .filter(Boolean)
        .join(', ');
    const amenitiesList = [...new Set(
        (Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []))
            .map(a => a.trim())
            .filter(Boolean)
    )];
    const home = new Home({
        houseName, price, location,
        addressLine1, addressLine2, city, state, pincode, country,
        no_of_bedRooms, photos, description,
        owner: req.user._id,
        homeType: HOME_TYPE_OPTIONS.includes(homeType) ? homeType : 'city',
        amenities: amenitiesList,
        maxGuests: parseInt(maxGuests, 10) || 2,
        checkInTime: checkInTime || "14:00",
        checkOutTime: checkOutTime || "11:00",
        cancellationPolicy: ['flexible','moderate','strict'].includes(cancellationPolicy)
            ? cancellationPolicy : 'moderate'
    });
    await home.save();

    // Geocoding hits a slow public API (OpenStreetMap/Nominatim) that can retry
    // multiple times internally. Don't make the host wait on it — the listing
    // is already saved; lat/lng just get filled in a moment later in the background.
    geocodeAddress({ addressLine1, addressLine2, city, state, pincode, country })
        .then(coords => {
            if (coords) {
                return Home.findByIdAndUpdate(home._id, { lat: coords.lat, lng: coords.lng });
            }
        })
        .catch(err => console.error("Background geocode failed for home", home._id.toString(), ":", err.message));

    try {
        await notify({
            userId: req.user._id,
            type: "host_home_added",
            title: "Listing published",
            message: `${home.houseName} was added to your listings.`,
            link: `/host/hostHomeList`,
            icon: "home",
            meta: { homeId: home._id.toString() }
        });
    } catch (notifyErr) {
        console.error("Home added notification failed:", notifyErr.message);
    }
    res.redirect('/host/hostHomeList');
};

const postEditHome = async (req, res, next) => {
    try {
        const homeId = req.params.homeId;
        if (!mongoose.Types.ObjectId.isValid(homeId)) {
            return res.status(404).send("Invalid Home ID");
        }
        let {
            houseName, price, addressLine1, addressLine2, city, state, pincode, country,
            no_of_bedRooms, description, amenities, maxGuests, checkInTime, checkOutTime,
            cancellationPolicy, existingPhotos, homeType
        } = req.body;

        price = parseInt(price, 10);
        if (isNaN(price) || price <= 0) {
            return res.status(400).send("Price must be a valid positive number!");
        }
        if (!addressLine1 || !city || !state || !pincode || !country) {
            return res.status(400).send("Building/street, city, state, pincode and country are all required");
        }
        if (!/^\d{6}$/.test(pincode.trim())) {
            return res.status(400).send("Pincode must be a valid 6-digit number");
        }
        if (homeType && !HOME_TYPE_OPTIONS.includes(homeType)) {
            return res.status(400).send("Invalid home type selected");
        }

        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");

        const newLocation = [addressLine1, addressLine2, city, state, pincode, country]
            .map(p => p && p.trim())
            .filter(Boolean)
            .join(', ');
        const originalPhotos = home.photos || [];
        const keptPhotos = Array.isArray(existingPhotos)
            ? existingPhotos
            : (existingPhotos ? [existingPhotos] : []);

        let newPhotos = [];
        if (req.files && req.files.length > 0) {
            try {
                newPhotos = await Promise.all(
                    req.files.map(file => uploadToCloudinary(file.buffer, 'Roovia/listings', 800, 600))
                );
            } catch (uploadErr) {
                return res.status(422).send(uploadErr.message);
            }
        }

        const finalPhotos = [...keptPhotos, ...newPhotos];
        if (finalPhotos.length === 0) {
            return res.status(400).send("At least one photo is required");
        }
        const photosChanged = newPhotos.length > 0 || keptPhotos.length !== originalPhotos.length;
        const locationChanged = newLocation !== home.location;
        home.photos = finalPhotos;
        home.houseName = houseName;
        home.price = price;
        home.location = newLocation;
        home.addressLine1 = addressLine1;
        home.addressLine2 = addressLine2 || '';
        home.city = city;
        home.state = state;
        home.pincode = pincode;
        home.country = country;
        home.no_of_bedRooms = no_of_bedRooms;
        home.description = description;
        home.homeType = HOME_TYPE_OPTIONS.includes(homeType) ? homeType : home.homeType;
        home.amenities = [...new Set(
            (Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []))
                .map(a => a.trim())
                .filter(Boolean)
        )];
        home.maxGuests = parseInt(maxGuests, 10) || 2;
        home.checkInTime = checkInTime || "14:00";
        home.checkOutTime = checkOutTime || "11:00";
        home.cancellationPolicy = ['flexible', 'moderate', 'strict'].includes(cancellationPolicy)
            ? cancellationPolicy : 'moderate';
        await home.save();
        if (locationChanged) {
            geocodeAddress({ addressLine1, addressLine2, city, state, pincode, country })
                .then(coords => {
                    if (coords) {
                        return Home.findByIdAndUpdate(home._id, { lat: coords.lat, lng: coords.lng });
                    }
                })
                .catch(err => console.error("Background geocode failed for home", home._id.toString(), ":", err.message));
        }
        try {
            await notify({
                userId: req.user._id,
                type: "host_home_updated",
                title: photosChanged ? "Home photos updated" : "Listing updated",
                message: photosChanged
                    ? `Photos for ${home.houseName} were updated.`
                    : `${home.houseName} was updated.`,
                link: `/host/hostHomeList`,
                icon: "home",
                meta: { homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Home updated notification failed:", notifyErr.message);
        }
        res.redirect("/host/hostHomeList");
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

const postDeleteHome = async (req, res, next) => {
    try {
        const homeId = req.params.homeId;
        if (!mongoose.Types.ObjectId.isValid(homeId)) {
            return res.status(404).send("Invalid Home ID");
        }
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) {
            return res.status(403).send("Forbidden");
        }
        const activeBookings = await Booking.find({ home: homeId, status: "upcoming" });

        if (activeBookings.length > 0 && req.body.confirmCancel !== "true") {
            return res.status(409).json({
                error: "active_bookings",
                count: activeBookings.length,
                message: `This listing has ${activeBookings.length} upcoming booking(s). You must cancel them (guests get a full refund + your note) before deleting.`
            });
        }
        if (activeBookings.length > 0) {
            const { noteType, predefinedReason, customNote } = req.body;
            const note = noteType === "custom"
                ? (customNote || "").trim().slice(0, 1000) || HOST_CANCEL_REASONS.other
                : (HOST_CANCEL_REASONS[predefinedReason] || HOST_CANCEL_REASONS.other);
            for (const booking of activeBookings) {
                await cancelBookingAsHost(booking._id, note);
            }
        }
        await Home.deleteOne({ _id: homeId });
        res.redirect("/host/hostHomeList");
    } catch (err) { next(err); }
}

export const postBlockDates = async (req, res) => {
    try {
        const { homeId, from, to, reason } = req.body;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");

        home.blockedDates.push({
            from: new Date(from),
            to: new Date(to),
            reason: reason || ""
        });
        await home.save();
        try {
            await notify({
                userId: req.user._id,
                type: "host_dates_blocked",
                title: "Dates blocked",
                message: `${new Date(from).toLocaleDateString("en-IN")} – ${new Date(to).toLocaleDateString("en-IN")} blocked on ${home.houseName} for other guests.`,
                link: `/host/manage/${homeId}`,
                icon: "calendar",
                meta: { homeId }
            });
        } catch (notifyErr) {
            console.error("Block dates notification failed:", notifyErr.message);
        }
        res.redirect("/host/manage/" + homeId);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

export const postUnblockDate = async (req, res) => {
    try {
        const { homeId, blockId } = req.params;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");

        home.blockedDates = home.blockedDates.filter(
            b => b._id.toString() !== blockId
        );
        await home.save();
        try {
            await notify({
                userId: req.user._id,
                type: "host_dates_unblocked",
                title: "Dates unblocked",
                message: `A blocked date range on ${home.houseName} was reopened for booking.`,
                link: `/host/manage/${homeId}`,
                icon: "calendar",
                meta: { homeId }
            });
        } catch (notifyErr) {
            console.error("Unblock date notification failed:", notifyErr.message);
        }
        res.redirect("/host/manage/" + homeId);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

export const getIcsExport = async (req, res, next) => {
    try {
        const { homeId, token } = req.params;
        const home = await Home.findById(homeId);
        if (!home || !home.icalExportToken || home.icalExportToken !== token) {
            return res.status(404).send("Not found");
        }
        const icsBody = await buildIcsForHome(home);
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${home.houseName.replace(/[^a-z0-9]/gi, "-")}.ics"`);
        res.send(icsBody);
    } catch (err) { next(err); }
};

export const getManageDates = async (req, res, next) => {
    try {
        const home = await Home.findOne({
            _id: req.params.homeId,
            owner: req.user._id
        });
        if (!home) return res.status(403).send("Forbidden");
        if (!home.icalExportToken) {
            home.icalExportToken = crypto.randomBytes(16).toString("hex");
            await home.save();
        }
        const bookings = await Booking.find({
            home: home._id
        }).sort({ checkIn: -1 }).populate("guest", "fname lname email phone");
        const reviews = await Review.find({ home: home._id })
            .populate("guest", "fname lname profileImage")
            .sort({ createdAt: -1 });
        res.render("host/manage", {
            pageTitle: "Manage",
            home,
            bookings,
            reviews
        });
    } catch (err) {
        next(err);
    }
};

export const postAddExternalCalendar = async (req, res, next) => {
    try {
        const { homeId, url, name } = req.body;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");
        if (!url) return res.status(400).send("Calendar URL is required");
        home.externalCalendars.push({ url: url.trim(), name: (name || "").trim() });
        await home.save();
        res.redirect("/host/manage/" + homeId);
    } catch (err) { next(err); }
};

export const postRemoveExternalCalendar = async (req, res, next) => {
    try {
        const { homeId, calId } = req.params;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");
        const cal = home.externalCalendars.id(calId);
        const calUrl = cal ? cal.url : null;
        home.externalCalendars = home.externalCalendars.filter(c => c._id.toString() !== calId);
        if (calUrl) {
            home.blockedDates = home.blockedDates.filter(b => b.source !== `ical:${calUrl}`);
        }
        await home.save();
        res.redirect("/host/manage/" + homeId);
    } catch (err) { next(err); }
};

export const postSyncExternalCalendars = async (req, res, next) => {
    try {
        const { homeId } = req.params;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");

        for (const cal of home.externalCalendars) {
            home.blockedDates = home.blockedDates.filter(b => b.source !== `ical:${cal.url}`);
            try {
                const events = await fetchExternalEvents(cal.url);
                events.forEach(ev => {
                    home.blockedDates.push({
                        from: ev.from,
                        to: ev.to,
                        reason: cal.name || "External calendar",
                        source: `ical:${cal.url}`
                    });
                });
                cal.lastSyncedAt = new Date();
            } catch (fetchErr) {
                console.error(`iCal sync failed for ${cal.url}:`, fetchErr.message);
            }
        }
        await home.save();
        res.redirect("/host/manage/" + homeId);
    } catch (err) { next(err); }
};

export const postAddSeasonalPricing = async (req, res, next) => {
    try {
        const { homeId, from, to, price, label } = req.body;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");
        const p = parseInt(price, 10);
        if (!from || !to || isNaN(p) || p <= 0) {
            return res.status(400).send("Valid date range and price are required");
        }
        home.seasonalPricing.push({
            from: new Date(from),
            to: new Date(to),
            price: p,
            label: (label || "").trim()
        });
        await home.save();
        res.redirect("/host/manage/" + homeId);
    } catch (err) { next(err); }
};

export const postRemoveSeasonalPricing = async (req, res, next) => {
    try {
        const { homeId, ruleId } = req.params;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");
        home.seasonalPricing = home.seasonalPricing.filter(r => r._id.toString() !== ruleId);
        await home.save();
        res.redirect("/host/manage/" + homeId);
    } catch (err) { next(err); }
};

export const getDashboard = async (req, res, next) => {
    try {
        const homes = await Home.find({ owner: req.user._id }).lean();
        const homeIds = homes.map(h => h._id);
        if (homeIds.length === 0) {
            return res.render("host/dashboard", {
                pageTitle: "Host Dashboard",
                stats: { totalRevenue: 0, totalBookings: 0, upcomingBookings: 0, completedBookings: 0, cancelledBookings: 0, avgRating: 0, totalReviews: 0 },
                monthlyData: [],
                mostBooked: null,
                recentBookings: [],
                upcomingCheckins: [],
                homes,
                payoutSummary: { pendingAmount: 0, pendingCount: 0, nextDue: null, paidAmount: 0 }
            });
        }
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // ALL 11 queries now run in a single Promise.all — one wave instead of two
        const [
            revenueResult,
            totalBookings,
            upcomingBookings,
            completedBookings,
            cancelledBookings,
            ratingResult,
            monthlyRaw,
            mostBookedRaw,
            recentBookings,
            upcomingCheckins,
            pendingPayoutResult,
            paidPayoutResult
        ] = await Promise.all([
            Booking.aggregate([{ $match: { home: { $in: homeIds }, paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]),
            Booking.countDocuments({ home: { $in: homeIds }, paymentStatus: "paid" }),
            Booking.countDocuments({ home: { $in: homeIds }, status: "upcoming" }),
            Booking.countDocuments({ home: { $in: homeIds }, status: "completed" }),
            Booking.countDocuments({ home: { $in: homeIds }, status: "cancelled" }),
            Review.aggregate([{ $match: { home: { $in: homeIds } } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]),
            Booking.aggregate([
                { $match: { home: { $in: homeIds }, paymentStatus: "paid", createdAt: { $gte: sixMonthsAgo } } },
                { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, bookings: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            Booking.aggregate([
                { $match: { home: { $in: homeIds }, paymentStatus: "paid" } },
                { $group: { _id: "$home", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]),
            Booking.find({ home: { $in: homeIds }, paymentStatus: "paid" })
                .populate("home", "houseName photo")
                .populate("guest", "fname lname profileImage")
                .sort({ createdAt: -1 }).limit(5).lean(),
            Booking.find({ home: { $in: homeIds }, paymentStatus: "paid", status: "upcoming", checkIn: { $gte: new Date() } })
                .populate("home", "houseName")
                .populate("guest", "fname lname profileImage")
                .sort({ checkIn: 1 }).limit(4).lean(),
            Booking.aggregate([
                { $match: { home: { $in: homeIds }, payoutStatus: "pending" } },
                { $group: { _id: null, amount: { $sum: "$payoutAmount" }, count: { $sum: 1 }, nextDue: { $min: "$payoutDueDate" } } }
            ]),
            Booking.aggregate([
                { $match: { home: { $in: homeIds }, payoutStatus: "paid" } },
                { $group: { _id: null, amount: { $sum: "$payoutAmount" } } }
            ])
        ]);

        const totalRevenue = revenueResult[0]?.total || 0;
        const avgRating = ratingResult[0] ? Math.round(ratingResult[0].avg * 10) / 10 : 0;
        const totalReviews = ratingResult[0]?.count || 0;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = monthlyRaw.map(m => ({
            label: monthNames[m._id.month - 1] + " " + m._id.year,
            bookings: m.bookings,
            revenue: m.revenue
        }));

        let mostBooked = null;
        if (mostBookedRaw.length > 0) {
            const mostBookedHome = homes.find(h => h._id.toString() === mostBookedRaw[0]._id.toString());
            mostBooked = {
                home: mostBookedHome,
                count: mostBookedRaw[0].count,
                revenue: mostBookedRaw[0].revenue
            };
        }

        const payoutSummary = {
            pendingAmount: pendingPayoutResult[0]?.amount || 0,
            pendingCount: pendingPayoutResult[0]?.count || 0,
            nextDue: pendingPayoutResult[0]?.nextDue || null,
            paidAmount: paidPayoutResult[0]?.amount || 0
        };

        res.render("host/dashboard", {
            pageTitle: "Host Dashboard",
            stats: { totalRevenue, totalBookings, upcomingBookings, completedBookings, cancelledBookings, avgRating, totalReviews },
            monthlyData,
            mostBooked,
            recentBookings,
            upcomingCheckins,
            homes,
            payoutSummary
        });
    } catch (err) {
        next(err);
    }
};

export const postPayoutDetails = async (req, res, next) => {
    try {
        const { method, accountHolderName, accountNumber, ifsc, upiId } = req.body;
        if (!['bank', 'upi'].includes(method)) {
            return res.status(400).send('Invalid payout method');
        }
        const User = (await import('../models/user.js')).default;
        const payoutDetails = { method };
        if (method === 'bank') {
            if (!accountHolderName || !accountNumber || !ifsc) {
                return res.status(400).send('All bank fields are required');
            }
            payoutDetails.accountHolderName = accountHolderName.trim();
            payoutDetails.accountNumber = accountNumber.trim();
            payoutDetails.ifsc = ifsc.trim().toUpperCase();
        } else {
            if (!upiId) return res.status(400).send('UPI ID is required');
            payoutDetails.upiId = upiId.trim();
        }
        await User.findByIdAndUpdate(req.user._id, { payoutDetails });
        res.redirect('/host/dashboard');
    } catch (err) { next(err); }
};

const fetchPayoutBookings = async (userId, year) => {
    const homes = await Home.find({ owner: userId });
    const homeIds = homes.map(h => h._id);
    if (homeIds.length === 0) return [];

    const query = { home: { $in: homeIds }, payoutStatus: { $ne: "not_applicable" } };
    if (year && !isNaN(parseInt(year, 10))) {
        const y = parseInt(year, 10);
        query.payoutDueDate = {
            $gte: new Date(`${y}-01-01T00:00:00.000Z`),
            $lt: new Date(`${y + 1}-01-01T00:00:00.000Z`)
        };
    }

    return Booking.find(query)
        .populate("home", "houseName")
        .populate("guest", "fname lname")
        .sort({ payoutDueDate: 1 });
};

export const exportPayoutsStatement = async (req, res, next) => {
    try {
        const { year, format } = req.query;
        const bookings = await fetchPayoutBookings(req.user._id, year);
        const period = year ? String(year) : "all-time";

        if (format === "pdf") {
            return sendPayoutPdf(res, bookings, period, req.user);
        }
        return sendPayoutCsv(res, bookings, period);
    } catch (err) {
        next(err);
    }
};

function sendPayoutCsv(res, bookings, period) {
    const esc = (val) => {
        const str = String(val ?? "");
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = [
        "Booking ID", "Property", "Guest", "Check-in", "Check-out",
        "Total Price", "Platform Commission %", "Platform Commission",
        "Payout Amount", "Payout Status", "Payout Method", "Payout Reference",
        "Payout Date", "Payout Due Date"
    ];

    const rows = bookings.map(b => [
        b._id.toString(),
        b.home?.houseName || "",
        b.guest ? `${b.guest.fname} ${b.guest.lname}` : "",
        new Date(b.checkIn).toISOString().slice(0, 10),
        new Date(b.checkOut).toISOString().slice(0, 10),
        b.totalPrice,
        b.platformCommissionPercent,
        b.platformCommission,
        b.payoutAmount,
        b.payoutStatus,
        b.payoutMethod || "",
        b.payoutReference || "",
        b.payoutDate ? new Date(b.payoutDate).toISOString().slice(0, 10) : "",
        b.payoutDueDate ? new Date(b.payoutDueDate).toISOString().slice(0, 10) : ""
    ]);

    const csv = [header, ...rows].map(row => row.map(esc).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="payout-statement-${period}.csv"`);
    res.send(csv);
}

function sendPayoutPdf(res, bookings, period, host) {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payout-statement-${period}.pdf"`);
    doc.pipe(res);
    doc.fillColor("#C9A96E").fontSize(20).font("Helvetica-Bold").text("Roovia");
    doc.moveDown(0.2);
    doc.fillColor("#1a1208").fontSize(15).font("Helvetica-Bold").text("Payout Statement");
    doc.fontSize(10).font("Helvetica").fillColor("#444")
        .text(`Host: ${host.fname} ${host.lname}`)
        .text(`Period: ${period === "all-time" ? "All time" : period}`)
        .text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
    doc.moveDown(0.8);
    const cols = [
        { label: "Property", x: 40, width: 130 },
        { label: "Guest", x: 170, width: 110 },
        { label: "Check-out", x: 280, width: 75 },
        { label: "Total", x: 355, width: 65 },
        { label: "Commission", x: 420, width: 65 },
        { label: "Payout", x: 485, width: 65 },
        { label: "Status", x: 550, width: 70 },
        { label: "Payout Date", x: 620, width: 75 },
        { label: "Reference", x: 695, width: 100 }
    ];

    const drawHeaderRow = () => {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#fff");
        doc.rect(40, doc.y, 755, 20).fill("#1a1208");
        const y = doc.y - 20 + 6;
        cols.forEach(c => doc.text(c.label, c.x, y, { width: c.width }));
        doc.moveDown(1.2);
        doc.fillColor("#1a1208");
    };

    drawHeaderRow();

    let total = 0;
    doc.font("Helvetica").fontSize(8.5);
    bookings.forEach((b, i) => {
        if (doc.y > 520) {
            doc.addPage({ size: "A4", layout: "landscape", margin: 40 });
            drawHeaderRow();
        }
        const y = doc.y;
        if (i % 2 === 0) doc.rect(40, y - 2, 755, 16).fill("#f9fafb").fillColor("#1a1208");

        doc.text(b.home?.houseName || "-", cols[0].x, y, { width: cols[0].width, ellipsis: true });
        doc.text(b.guest ? `${b.guest.fname} ${b.guest.lname}` : "-", cols[1].x, y, { width: cols[1].width, ellipsis: true });
        doc.text(new Date(b.checkOut).toLocaleDateString("en-IN"), cols[2].x, y, { width: cols[2].width });
        doc.text(`$${b.totalPrice}`, cols[3].x, y, { width: cols[3].width });
        doc.text(`$${b.platformCommission}`, cols[4].x, y, { width: cols[4].width });
        doc.text(`$${b.payoutAmount}`, cols[5].x, y, { width: cols[5].width });
        doc.text(b.payoutStatus, cols[6].x, y, { width: cols[6].width });
        doc.text(b.payoutDate ? new Date(b.payoutDate).toLocaleDateString("en-IN") : "-", cols[7].x, y, { width: cols[7].width });
        doc.text(b.payoutReference || "-", cols[8].x, y, { width: cols[8].width, ellipsis: true });

        total += b.payoutAmount;
        doc.moveDown(1.1);
    });

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1208")
        .text(`Total payout amount: $${total}`, 40, doc.y);

    doc.end();
}

export const getHomeAnalytics = async (req, res, next) => {
    try {
        const home = await Home.findOne({ _id: req.params.homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");
        // NEW: populate guest.city so we can build the Guest Origins block below
        const paidBookings = await Booking.find({ home: home._id, paymentStatus: "paid" })
            .populate("guest", "city");
        const totalRevenue = paidBookings.reduce((sum, b) => sum + b.totalPrice, 0);
        const totalBookings = paidBookings.length;
        const upcomingCount = paidBookings.filter(b => b.status === "upcoming").length;
        const completedCount = paidBookings.filter(b => b.status === "completed").length;
        const cancelledCount = paidBookings.filter(b => b.status === "cancelled").length;
        const cancellationRate = totalBookings > 0
            ? Math.round((cancelledCount / totalBookings) * 100)
            : 0;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyMap = {};
        paidBookings
            .filter(b => new Date(b.createdAt) >= sixMonthsAgo)
            .forEach(b => {
                const d = new Date(b.createdAt);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                if (!monthlyMap[key]) {
                    monthlyMap[key] = { year: d.getFullYear(), month: d.getMonth(), bookings: 0, revenue: 0 };
                }
                monthlyMap[key].bookings += 1;
                monthlyMap[key].revenue += b.totalPrice;
            });
        const monthlyData = Object.values(monthlyMap)
            .sort((a, b) => a.year - b.year || a.month - b.month)
            .map(m => ({ label: `${monthNames[m.month]} ${m.year}`, bookings: m.bookings, revenue: m.revenue }));
        let bestMonth = null, worstMonth = null;
        if (monthlyData.length > 0) {
            bestMonth = monthlyData.reduce((a, b) => (b.revenue > a.revenue ? b : a));
            worstMonth = monthlyData.reduce((a, b) => (b.revenue < a.revenue ? b : a));
        }
        const activeBookings = paidBookings.filter(b => b.status !== "cancelled");
        const now = new Date();
        const occupancyData = [];
        let totalNightsBooked = 0;
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear(), month = d.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 1);
            let bookedNights = 0;
            activeBookings.forEach(b => {
                const start = new Date(Math.max(new Date(b.checkIn), monthStart));
                const end = new Date(Math.min(new Date(b.checkOut), monthEnd));
                if (end > start) {
                    bookedNights += Math.round((end - start) / (1000 * 60 * 60 * 24));
                }
            });
            totalNightsBooked += bookedNights;
            occupancyData.push({
                label: `${monthNames[month]} ${year}`,
                occupancyPercent: Math.min(100, Math.round((bookedNights / daysInMonth) * 100))
            });
        }
        let totalNightsAllTime = 0;
        let totalLeadDays = 0;
        let weekdayNights = 0;
        let weekendNights = 0;
        const guestBookingCounts = {};

        // NEW: per-night buckets for the calendar heatmap and day-of-week chart,
        // built in the same pass as the existing weekday/weekend counters below
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);
        const dailyActivityMap = {};
        const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat

        activeBookings.forEach(b => {
            const checkIn = new Date(b.checkIn);
            const checkOut = new Date(b.checkOut);
            const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
            totalNightsAllTime += nights;
            const leadDays = Math.max(0, Math.round((checkIn - new Date(b.createdAt)) / (1000 * 60 * 60 * 24)));
            totalLeadDays += leadDays;
            for (let n = 0; n < nights; n++) {
                const night = new Date(checkIn);
                night.setDate(night.getDate() + n);
                const day = night.getDay();
                if (day === 5 || day === 6) weekendNights++;
                else weekdayNights++;

                // NEW: tally this night for the day-of-week chart
                dowCounts[day] += 1;

                // NEW: tally this night for the last-12-months heatmap
                const oneYearAgo = new Date();
                oneYearAgo.setDate(oneYearAgo.getDate() - 365);
                const oneYearAhead = new Date();
                oneYearAhead.setDate(oneYearAhead.getDate() + 365);
                if (night >= oneYearAgo && night <= oneYearAhead) {
                const iso = night.toISOString().slice(0, 10);
                dailyActivityMap[iso] = (dailyActivityMap[iso] || 0) + 1;
                }
            }
            // guest is now populated (see the .populate("guest", "city") above),
            // so read its _id rather than calling .toString() on the whole doc
            const guestId = b.guest && b.guest._id ? b.guest._id.toString()
                : (b.guest ? b.guest.toString() : null);
            if (guestId) {
                guestBookingCounts[guestId] = (guestBookingCounts[guestId] || 0) + 1;
            }
        });

        // NEW: shape the two per-night tallies into what the view expects
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayOfWeekData = dayNames.map((day, i) => ({ day, bookings: dowCounts[i] }));
        const dailyActivity = Object.entries(dailyActivityMap)
            .map(([date, nights]) => ({ date, nights }));

        // NEW: guest origins by city — requires `city` on the User model (populated
        // above via .populate("guest", "city")). If your schema stores location
        // differently (e.g. a nested address object), swap b.guest.city below to match.
        const guestOriginsMap = {};
        activeBookings.forEach(b => {
            const city = b.guest && b.guest.city ? b.guest.city.trim() : null;
            if (city) guestOriginsMap[city] = (guestOriginsMap[city] || 0) + 1;
        });
        const guestOrigins = Object.entries(guestOriginsMap)
            .map(([location, count]) => ({ location, count }));

        const avgNightlyRate = totalNightsAllTime > 0
            ? Math.round(totalRevenue / totalNightsAllTime)
            : 0;
        const avgLengthOfStay = activeBookings.length > 0
            ? Math.round((totalNightsAllTime / activeBookings.length) * 10) / 10
            : 0;
        const avgLeadTimeDays = activeBookings.length > 0
            ? Math.round(totalLeadDays / activeBookings.length)
            : 0;
        const repeatGuestCount = Object.values(guestBookingCounts).filter(c => c > 1).length;
        const totalNights = weekdayNights + weekendNights;
        const weekendShare = totalNights > 0 ? Math.round((weekendNights / totalNights) * 100) : 0;
        const weekdayShare = totalNights > 0 ? 100 - weekendShare : 0;
        const reviews = await Review.find({ home: home._id, createdAt: { $gte: sixMonthsAgo } });
        const ratingMap = {};
        reviews.forEach(r => {
            const d = new Date(r.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!ratingMap[key]) {
                ratingMap[key] = { year: d.getFullYear(), month: d.getMonth(), total: 0, count: 0 };
            }
            ratingMap[key].total += r.rating;
            ratingMap[key].count += 1;
        });
        const ratingTrend = Object.values(ratingMap)
            .sort((a, b) => a.year - b.year || a.month - b.month)
            .map(m => ({
                label: `${monthNames[m.month]} ${m.year}`,
                avgRating: Math.round((m.total / m.count) * 10) / 10,
                count: m.count
            }));

        // NEW: review category radar — only populated if your Review schema has
        // these per-category numeric fields (cleanliness, accuracy, checkin,
        // communication, location, value). If it only stores an overall `rating`,
        // this safely resolves to null and the view falls back gracefully.
        const subRatingKeys = ["cleanliness", "accuracy", "checkin", "communication", "location", "value"];
        const hasSubRatings = reviews.length > 0 && subRatingKeys.every(k => typeof reviews[0][k] === "number");
        let reviewCategories = null;
        if (hasSubRatings) {
            const sums = Object.fromEntries(subRatingKeys.map(k => [k, 0]));
            reviews.forEach(r => subRatingKeys.forEach(k => { sums[k] += r[k] || 0; }));
            reviewCategories = Object.fromEntries(
                subRatingKeys.map(k => [k, Math.round((sums[k] / reviews.length) * 10) / 10])
            );
        }

        // free extra KPI — revenue per booking, using data already computed above
        const revenuePerBooking = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
        const totalGuestsHosted = activeBookings.reduce((sum, b) => sum + (b.guests || 0), 0);
        const payoutOverview = paidBookings.reduce((acc, b) => {
            if (b.payoutStatus === "pending") acc.pending += b.payoutAmount || 0;
            else if (b.payoutStatus === "paid") acc.paid += b.payoutAmount || 0;
            else if (b.payoutStatus === "failed") acc.failed += b.payoutAmount || 0;
            return acc;
        }, { pending: 0, paid: 0, failed: 0 });
        res.render("host/homeAnalytics", {
            pageTitle: `Analytics — ${home.houseName}`,
            home,
            totalRevenue, totalBookings, upcomingCount, completedCount, cancelledCount,
            cancellationRate,
            monthlyData, occupancyData,
            bestMonth, worstMonth,
            avgNightlyRate, avgLengthOfStay, avgLeadTimeDays,
            repeatGuestCount,
            weekdayShare, weekendShare,
            ratingTrend,
            totalNightsAllTime,
            revenuePerBooking,
            totalGuestsHosted,
            payoutOverview,
            dailyActivity,
            dayOfWeekData,
            guestOrigins,
            reviewCategories
        });
    } catch (err) {
        next(err);
    }
};

export const hostController = { postDeleteHome, getaddHome, postaddHome, hostHomeList, getEditHome, postEditHome, postBlockDates, postUnblockDate, getManageDates, getDashboard, postPayoutDetails, exportPayoutsStatement, getIcsExport, postAddExternalCalendar, postRemoveExternalCalendar, postSyncExternalCalendars, postAddSeasonalPricing, postRemoveSeasonalPricing, getHomeAnalytics };
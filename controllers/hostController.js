import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import crypto from "crypto";
import Booking from '../models/booking.js';
import Home from '../models/home.js';
import Review from "../models/review.js";
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js';
import { geocodeAddress } from '../utils/geocode.js';
import { buildIcsForHome } from "../utils/icalExport.js";
import { fetchExternalEvents } from "../utils/icalImport.js";

const getaddHome=(req, res, next) => {
    res.render("host/editHome",{ 
        pageTitle: 'Add Home',
        editing:false,
    });
}

const getEditHome = async (req,res,next)=>{
    try{
        const homeId = req.params.homeId;
        if(!mongoose.Types.ObjectId.isValid(homeId)){
            return res.status(404).send("Invalid Home ID");
        }
        const home = await Home.findOne({
            _id: homeId,
            owner: req.user._id
        });
        if(!home){
            return res.status(403).send("Forbidden");
        }
        res.render("host/editHome",{
            home,
            pageTitle:"Edit Home",
            editing:true,
        });
    }catch(err) { next(err); }
}

const hostHomeList = async (req, res, next) => {
    try {
        const rows = await Home.find({ owner: req.user._id });
        res.render("host/hostHomeList", { pageTitle: 'Host Home List', registeredHomes: rows });
    } catch (err) {
        next(err);
    }
};

const postaddHome = async (req, res, next) => {
    let { houseName, price, location, no_of_bedRooms,  description,
          amenities, maxGuests, checkInTime, checkOutTime, cancellationPolicy } = req.body;
    if (!houseName || houseName.trim().length < 3) {
        return res.status(400).send("House name must be at least 3 characters");
    }
    if (price < 100 || price > 1000000) {
        return res.status(400).send("Price must be between ₹100 and ₹10,00,000");
    }
    if (!location || location.trim().length < 2) {
        return res.status(400).send("Location is required");
    }
    const beds = parseInt(no_of_bedRooms, 10);
    if (isNaN(beds) || beds < 1 || beds > 20) {
        return res.status(400).send("Bedrooms must be between 1 and 20");
    }
    price = parseInt(price, 10);
    if (isNaN(price) || price <= 0) {
        return res.status(400).send("Price must be a valid positive number!");
    }
    if (!req.files || req.files.length === 0) {
        return res.status(422).send("No images provided by the host");
    }

    let photos;
    try {
        photos = await Promise.all(
            req.files.map(file =>
                uploadToCloudinary(file.buffer, 'homestays/listings', 800, 600)
            )
        );
    } catch (uploadErr) {
        return res.status(422).send(uploadErr.message);
    }
        const coords = await geocodeAddress(location);
        // Checkboxes with the same name submit as an array if 2+ are checked,
        // a single string if exactly 1 is checked, or undefined if none.
        const amenitiesList = Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []);

        const home = new Home({
            houseName, price, location, no_of_bedRooms, photos, description,
            owner: req.user._id,
            lat: coords?.lat,
            lng: coords?.lng,
            amenities: amenitiesList,
            maxGuests: parseInt(maxGuests, 10) || 2,
            checkInTime: checkInTime || "14:00",
            checkOutTime: checkOutTime || "11:00",
            cancellationPolicy: ['flexible','moderate','strict'].includes(cancellationPolicy)
                ? cancellationPolicy : 'moderate'
        });
        await home.save();
        res.redirect('/host/hostHomeList');
};

const postEditHome = async (req, res, next) => {
    try {
        const homeId = req.params.homeId;
        if(!mongoose.Types.ObjectId.isValid(homeId)){
            return res.status(404).send("Invalid Home ID");
        }
        let {
            houseName,
            price,
            location,
            no_of_bedRooms,
            description,
            amenities,
            maxGuests,
            checkInTime,
            checkOutTime,
            cancellationPolicy
        } = req.body;
        price = parseInt(price, 10);
        if (isNaN(price) || price <= 0) {
            return res.status(400).send("Price must be a valid positive number!");
        }
        const home = await Home.findOne({
            _id: homeId,
            owner: req.user._id
        });
        if (!home) {
            return res.status(403).send("Forbidden");
        }
        home.houseName = houseName;
        home.price = price;
        if (location !== home.location) {
            const coords = await geocodeAddress(location);
            home.lat = coords?.lat;
            home.lng = coords?.lng;
        }
        home.location = location;
        home.no_of_bedRooms = no_of_bedRooms;
        home.description = description;
        home.amenities = Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []);
        home.maxGuests = parseInt(maxGuests, 10) || 2;
        home.checkInTime = checkInTime || "14:00";
        home.checkOutTime = checkOutTime || "11:00";
        home.cancellationPolicy = ['flexible','moderate','strict'].includes(cancellationPolicy)
            ? cancellationPolicy : 'moderate';
        if (req.files && req.files.length > 0) {
            try {
                home.photos = await Promise.all(
                    req.files.map(file =>
                        uploadToCloudinary(file.buffer, 'homestays/listings', 800, 600)
                    )
                );
            } catch (uploadErr) {
                return res.status(422).send(uploadErr.message);
            }
        }
        await home.save();
        res.redirect("/host/hostHomeList");
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

const postDeleteHome = async (req,res,next)=>{
    try{
        const homeId = req.params.homeId;
        if(!mongoose.Types.ObjectId.isValid(homeId)){
            return res.status(404).send("Invalid Home ID");
        }   
        const result = await Home.findOneAndDelete({
            _id: homeId,
            owner: req.user._id
        });
        if(!result){
            return res.status(403).send("Forbidden");
        }
        res.redirect("/host/hostHomeList");
    }catch(err) { next(err); }
}

export const postBlockDates = async (req, res) => {
    try {
        const { homeId, from, to, reason } = req.body;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");

        home.blockedDates.push({
            from: new Date(from),
            to:   new Date(to),
            reason: reason || ""
        });
        await home.save();
        res.redirect("/host/manage-dates/" + homeId);
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
        res.redirect("/host/manage-dates/" + homeId);
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
            home: home._id,
            status: { $ne: "cancelled" }
        }).populate("guest", "fname lname email");
        const reviews = await Review.find({ home: home._id })
            .populate("guest", "fname lname profileImage")
            .sort({ createdAt: -1 });
        res.render("host/manageDates", {
            pageTitle: "Manage Dates",
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
        res.redirect("/host/manage-dates/" + homeId);
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
            // drop any blocks that came from this calendar so removing it removes its blocks too
            home.blockedDates = home.blockedDates.filter(b => b.source !== `ical:${calUrl}`);
        }
        await home.save();
        res.redirect("/host/manage-dates/" + homeId);
    } catch (err) { next(err); }
};

export const postSyncExternalCalendars = async (req, res, next) => {
    try {
        const { homeId } = req.params;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");

        for (const cal of home.externalCalendars) {
            // clear this calendar's previous blocks before re-adding fresh ones
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
        res.redirect("/host/manage-dates/" + homeId);
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
        res.redirect("/host/manage-dates/" + homeId);
    } catch (err) { next(err); }
};

export const postRemoveSeasonalPricing = async (req, res, next) => {
    try {
        const { homeId, ruleId } = req.params;
        const home = await Home.findOne({ _id: homeId, owner: req.user._id });
        if (!home) return res.status(403).send("Forbidden");
        home.seasonalPricing = home.seasonalPricing.filter(r => r._id.toString() !== ruleId);
        await home.save();
        res.redirect("/host/manage-dates/" + homeId);
    } catch (err) { next(err); }
};

export const getDashboard = async (req, res, next) => {
    try {
        const homes = await Home.find({ owner: req.user._id });
        const homeIds = homes.map(h => h._id);
        if (homeIds.length === 0) {
            return res.render("host/dashboard", {
                pageTitle: "Host Dashboard",
                stats: { totalRevenue: 0, totalBookings: 0, upcomingBookings: 0, completedBookings: 0, avgRating: 0 },
                monthlyData: [],
                mostBooked: null,
                recentBookings: [],
                homes
            });
        }
        const revenueResult = await Booking.aggregate([
            { $match: { home: { $in: homeIds }, paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;
        const totalBookings     = await Booking.countDocuments({ home: { $in: homeIds }, paymentStatus: "paid" });
        const upcomingBookings  = await Booking.countDocuments({ home: { $in: homeIds }, status: "upcoming" });
        const completedBookings = await Booking.countDocuments({ home: { $in: homeIds }, status: "completed" });
        const ratingResult = await Review.aggregate([
            { $match: { home: { $in: homeIds } } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);
        const avgRating    = ratingResult[0] ? Math.round(ratingResult[0].avg * 10) / 10 : 0;
        const totalReviews = ratingResult[0]?.count || 0;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyRaw = await Booking.aggregate([
            {
                $match: {
                    home: { $in: homeIds },
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
        const mostBookedRaw = await Booking.aggregate([
            { $match: { home: { $in: homeIds }, paymentStatus: "paid" } },
            { $group: { _id: "$home", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);
        let mostBooked = null;
        if (mostBookedRaw.length > 0) {
            const mostBookedHome = homes.find(h => h._id.toString() === mostBookedRaw[0]._id.toString());
            mostBooked = {
                home:    mostBookedHome,
                count:   mostBookedRaw[0].count,
                revenue: mostBookedRaw[0].revenue
            };
        }
        const recentBookings = await Booking.find({
            home: { $in: homeIds },
            paymentStatus: "paid"
        })
        .populate("home", "houseName photo")
        .populate("guest", "fname lname profileImage")
        .sort({ createdAt: -1 })
        .limit(5);
         const [pendingPayoutResult, paidPayoutResult] = await Promise.all([
            Booking.aggregate([
                { $match: { home: { $in: homeIds }, payoutStatus: "pending" } },
                { $group: { _id: null, amount: { $sum: "$payoutAmount" }, count: { $sum: 1 }, nextDue: { $min: "$payoutDueDate" } } }
            ]),
            Booking.aggregate([
                { $match: { home: { $in: homeIds }, payoutStatus: "paid" } },
                { $group: { _id: null, amount: { $sum: "$payoutAmount" } } }
            ])
        ]);
        const payoutSummary = {
            pendingAmount: pendingPayoutResult[0]?.amount || 0,
            pendingCount:  pendingPayoutResult[0]?.count || 0,
            nextDue:       pendingPayoutResult[0]?.nextDue || null,
            paidAmount:    paidPayoutResult[0]?.amount || 0
        };
        res.render("host/dashboard", {
            pageTitle: "Host Dashboard",
            stats: { totalRevenue, totalBookings, upcomingBookings, completedBookings, avgRating, totalReviews },
            monthlyData,
            mostBooked,
            recentBookings,
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
            $lt:  new Date(`${y + 1}-01-01T00:00:00.000Z`)
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

    // Header
    doc.fillColor("#C9A96E").fontSize(20).font("Helvetica-Bold").text("HomeStays");
    doc.moveDown(0.2);
    doc.fillColor("#1a1208").fontSize(15).font("Helvetica-Bold").text("Payout Statement");
    doc.fontSize(10).font("Helvetica").fillColor("#444")
       .text(`Host: ${host.fname} ${host.lname}`)
       .text(`Period: ${period === "all-time" ? "All time" : period}`)
       .text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
    doc.moveDown(0.8);

    // Table columns: [label, x, width]
    const cols = [
        { label: "Property",   x: 40,  width: 130 },
        { label: "Guest",      x: 170, width: 110 },
        { label: "Check-out",  x: 280, width: 75  },
        { label: "Total",      x: 355, width: 65  },
        { label: "Commission", x: 420, width: 65  },
        { label: "Payout",     x: 485, width: 65  },
        { label: "Status",     x: 550, width: 70  },
        { label: "Payout Date",x: 620, width: 75  },
        { label: "Reference",  x: 695, width: 100 }
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

        const paidBookings = await Booking.find({ home: home._id, paymentStatus: "paid" });

        const totalRevenue   = paidBookings.reduce((sum, b) => sum + b.totalPrice, 0);
        const totalBookings  = paidBookings.length;
        const upcomingCount  = paidBookings.filter(b => b.status === "upcoming").length;
        const completedCount = paidBookings.filter(b => b.status === "completed").length;
        const cancelledCount = paidBookings.filter(b => b.status === "cancelled").length;

        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Revenue / bookings by month (based on when the booking was made)
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
                monthlyMap[key].revenue  += b.totalPrice;
            });
        const monthlyData = Object.values(monthlyMap)
            .sort((a, b) => a.year - b.year || a.month - b.month)
            .map(m => ({ label: `${monthNames[m.month]} ${m.year}`, bookings: m.bookings, revenue: m.revenue }));

        // Occupancy rate by calendar month (based on nights actually booked, so cancellations free up the nights)
        const activeBookings = paidBookings.filter(b => b.status !== "cancelled");
        const now = new Date();
        const occupancyData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear(), month = d.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthStart = new Date(year, month, 1);
            const monthEnd   = new Date(year, month + 1, 1);
            let bookedNights = 0;
            activeBookings.forEach(b => {
                const start = new Date(Math.max(new Date(b.checkIn), monthStart));
                const end   = new Date(Math.min(new Date(b.checkOut), monthEnd));
                if (end > start) {
                    bookedNights += Math.round((end - start) / (1000 * 60 * 60 * 24));
                }
            });
            occupancyData.push({
                label: `${monthNames[month]} ${year}`,
                occupancyPercent: Math.min(100, Math.round((bookedNights / daysInMonth) * 100))
            });
        }

        res.render("host/homeAnalytics", {
            pageTitle: `Analytics — ${home.houseName}`,
            home,
            totalRevenue, totalBookings, upcomingCount, completedCount, cancelledCount,
            monthlyData, occupancyData
        });
    } catch (err) {
        next(err);
    }
};

export const hostController={postDeleteHome,getaddHome,postaddHome,hostHomeList,getEditHome,postEditHome,postBlockDates,postUnblockDate,getManageDates,getDashboard,postPayoutDetails, exportPayoutsStatement, getIcsExport,postAddExternalCalendar, postRemoveExternalCalendar, postSyncExternalCalendars, postAddSeasonalPricing, postRemoveSeasonalPricing, getHomeAnalytics};
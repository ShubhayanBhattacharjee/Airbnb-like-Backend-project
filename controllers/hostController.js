import mongoose from "mongoose";
import Booking from '../models/booking.js';
import Home from '../models/home.js';
import Review from "../models/review.js";
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js';
import { geocodeAddress } from '../utils/geocode.js';

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

export const getManageDates = async (req, res) => {
    try {
        const home = await Home.findOne({
            _id: req.params.homeId,
            owner: req.user._id
        });
        if (!home) return res.status(403).send("Forbidden");
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
        res.render("host/dashboard", {
            pageTitle: "Host Dashboard",
            stats: { totalRevenue, totalBookings, upcomingBookings, completedBookings, avgRating, totalReviews },
            monthlyData,
            mostBooked,
            recentBookings,
            homes
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

export const hostController={postDeleteHome,getaddHome,postaddHome,hostHomeList,getEditHome,postEditHome,postBlockDates,postUnblockDate,getManageDates,getDashboard,postPayoutDetails};
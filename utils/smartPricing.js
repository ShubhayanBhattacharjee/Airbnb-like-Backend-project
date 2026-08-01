import Booking from "../models/booking.js";
import Home from "../models/home.js";

const DEFAULT_DOW_FACTORS = { 0: 1.05, 1: 0.95, 2: 0.95, 3: 0.95, 4: 1.0, 5: 1.15, 6: 1.2 };
// 0=Sun ... 6=Sat (matches JS Date#getDay). Used until a city has enough real data.

const MIN_BOOKINGS_FOR_CITY_STATS = 20;
const BASELINE_OCCUPANCY = 0.35;   // target "healthy" occupancy for comparable homes
const DEMAND_SENSITIVITY = 0.8;
const OVERALL_MIN_MULTIPLIER = 0.75;
const OVERALL_MAX_MULTIPLIER = 1.6;

// Learns weekday demand for a city from real booking history (checkIn day-of-week).
// Falls back to DEFAULT_DOW_FACTORS when there isn't enough data yet.
export const getDayOfWeekFactors = async (city) => {
    const rows = await Booking.aggregate([
        { $match: { paymentStatus: "paid", status: { $ne: "cancelled" } } },
        { $lookup: { from: "homes", localField: "home", foreignField: "_id", as: "home" } },
        { $unwind: "$home" },
        { $match: { "home.city": city } },
        { $group: { _id: { $dayOfWeek: "$checkIn" }, count: { $sum: 1 } } } // Mongo: 1=Sun..7=Sat
    ]);

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    if (total < MIN_BOOKINGS_FOR_CITY_STATS) {
        return DEFAULT_DOW_FACTORS;
    }

    const avg = total / 7;
    const factors = { ...DEFAULT_DOW_FACTORS };
    for (const r of rows) {
        const jsDay = r._id - 1; // convert Mongo's 1-7 to JS getDay()'s 0-6
        const raw = r.count / avg;
        factors[jsDay] = Math.min(1.3, Math.max(0.85, raw)); // clamp per-day noise
    }
    return factors;
};

// How booked-up are comparable homes (same city + homeType) for these dates?
export const getCityDemandFactor = async (home, checkIn, checkOut) => {
    const comparableHomes = await Home.find({
        city: home.city,
        homeType: home.homeType,
        _id: { $ne: home._id }
    }).select("_id");

    if (comparableHomes.length === 0) return 1; // no comps — don't guess

    const homeIds = comparableHomes.map(h => h._id);
    const overlappingCount = await Booking.countDocuments({
        home: { $in: homeIds },
        paymentStatus: "paid",
        status: { $ne: "cancelled" },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn }
    });

    const occupancyRatio = overlappingCount / comparableHomes.length;
    const raw = 1 + (occupancyRatio - BASELINE_OCCUPANCY) * DEMAND_SENSITIVITY;
    return Math.min(1.4, Math.max(0.8, raw));
};

// Suggested price for a single night.
export const getSuggestedPriceForDate = async (home, date, dowFactors) => {
    const d = new Date(date);
    const dayFactor = dowFactors[d.getDay()];
    const nightEnd = new Date(d);
    nightEnd.setDate(nightEnd.getDate() + 1);

    const demandFactor = await getCityDemandFactor(home, d, nightEnd);
    const rawMultiplier = dayFactor * demandFactor;
    const clampedMultiplier = Math.min(OVERALL_MAX_MULTIPLIER, Math.max(OVERALL_MIN_MULTIPLIER, rawMultiplier));

    const suggested = Math.round((home.price * clampedMultiplier) / 10) * 10; // round to nearest ₹10
    return { date: d, suggestedPrice: suggested, dayFactor, demandFactor };
};

// Suggested prices across a date range (mirrors getTotalPriceForRange's style).
export const getSuggestedPriceRange = async (home, checkIn, checkOut) => {
    const dowFactors = await getDayOfWeekFactors(home.city);
    const results = [];
    const cursor = new Date(checkIn);
    const outDate = new Date(checkOut);
    while (cursor < outDate) {
        results.push(await getSuggestedPriceForDate(home, cursor, dowFactors));
        cursor.setDate(cursor.getDate() + 1);
    }
    return results;
};
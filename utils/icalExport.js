import ical from "ical-generator";
import Booking from "../models/booking.js";

export const buildIcsForHome = async (home) => {
    const calendar = ical({ name: `${home.houseName} — HomeStays` });
    const bookings = await Booking.find({
        home: home._id,
        status: { $ne: "cancelled" },
        paymentStatus: "paid"
    });
    bookings.forEach(b => {
        calendar.createEvent({
            start: b.checkIn,
            end: b.checkOut,
            summary: "Booked (HomeStays)",
            description: `Booking ${b._id}`,
            uid: `booking-${b._id}@homestays`
        });
    });
    home.blockedDates
        .filter(bd => bd.source === "manual")
        .forEach(bd => {
            calendar.createEvent({
                start: bd.from,
                end: bd.to,
                summary: bd.reason ? `Blocked: ${bd.reason}` : "Blocked",
                uid: `block-${bd._id}@homestays`
            });
        });
    return calendar.toString();
};
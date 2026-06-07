import Booking from "../models/booking.js";
import Home from "../models/home.js";

export const getUnavailableHomeIds = async (checkIn, checkOut) => {
    const inDate  = new Date(checkIn);
    const outDate = new Date(checkOut);
    const homes = await Home.find({}, '_id blockedDates');
    const unavailableIds = [];
    for (const home of homes) {
        const blockedConflict = home.blockedDates.some(b =>
            inDate < b.to && outDate > b.from
        );
        if (blockedConflict) {
            unavailableIds.push(home._id);
            continue;
        }
        const bookingConflict = await Booking.findOne({
            home: home._id,
            status: { $ne: "cancelled" },
            paymentStatus: "paid",
            checkIn: { $lt: outDate },
            checkOut: { $gt: inDate }
        });
        if (bookingConflict) {
            unavailableIds.push(home._id);
        }
    }
    return unavailableIds;
};
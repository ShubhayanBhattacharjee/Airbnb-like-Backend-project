import User from "../models/user.js";
import Home from "../models/home.js";
import Booking from "../models/booking.js";

export const hostsController = {
    hosts: async (req, res, next) => {
        try {
            const hosts = await User.find({ role: "host" });
            const hostsWithData = await Promise.all(
                hosts.map(async (host) => {
                    const homes = await Home.find({ owner: host._id });
                    const totalBookings = await Booking.countDocuments({
                        home: { $in: homes.map(h => h._id) },
                        status: "completed"
                    });
                    return {
                        ...host.toObject(),
                        homes,
                        totalListings: homes.length,
                        totalBookings
                    };
                })
            );
            res.render("hosts", {
                pageTitle: "Our Hosts",
                hosts: hostsWithData,
                countries: [...new Set(hostsWithData.map(h => h.country).filter(Boolean))]
            });
        } catch (err) {
            next(err);
        }
    }
};
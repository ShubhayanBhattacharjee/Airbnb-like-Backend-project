import User from "../models/user.js";
import Home from "../models/home.js";
import Booking from "../models/booking.js";

const DEFAULT_PROFILE_IMAGE = "/images/default-profile.png";
const DEFAULT_HOME_IMAGE = "/images/default-home.jpg";

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
                        profileImage: host.profileImage || DEFAULT_PROFILE_IMAGE,
                        homes: homes.map(h => ({
                            ...h.toObject(),
                            photo: h.photo || DEFAULT_HOME_IMAGE
                        })),
                        totalListings: homes.length,
                        totalBookings
                    };
                })
            );
            hostsWithData.sort((a, b) => {
                const nameA = `${a.fname} ${a.lname}`.toLowerCase();
                const nameB = `${b.fname} ${b.lname}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
            const totalHosts = hostsWithData.length;
            const homes = await Home.find({}, "country");
            const totalCountries = new Set(
                homes
                    .map(home => home.country?.trim())
                    .filter(Boolean)
            ).size;
            res.render("hosts", {
                pageTitle: "Our Hosts",
                hosts: hostsWithData,
                countries: [...new Set(hostsWithData.map(h => h.country).filter(Boolean))],
                heroStats: {
                    totalHosts,
                    totalCountries,
                    guestRating: 4.9
                }
            });
        } catch (err) {
            next(err);
        }
    }
};
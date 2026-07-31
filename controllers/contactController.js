import Booking from "../models/booking.js";
import Home from "../models/home.js";

const contact = async (req, res) => {
  let myBookings = [];
  let myProperties = [];

  try {
    if (req.user) {
      if (req.user.role === "host") {
        // A host can only raise a ticket about a property that has at
        // least one real booking made against it.
        const homes = await Home.find({ owner: req.user._id })
          .select("_id houseName city state")
          .lean();
        const homeIds = homes.map((h) => h._id);

        const bookedHomeIds = homeIds.length
          ? await Booking.distinct("home", { home: { $in: homeIds } })
          : [];
        const bookedSet = new Set(bookedHomeIds.map((id) => id.toString()));

        myProperties = homes.filter((h) => bookedSet.has(h._id.toString()));
      } else {
        // A guest can only raise a ticket about a booking they actually made.
        myBookings = await Booking.find({ guest: req.user._id })
          .populate("home", "houseName city state")
          .sort({ createdAt: -1 })
          .select("bookingId home checkIn checkOut status")
          .lean();
      }
    }
  } catch (err) {
    console.error("contact page: failed to load booking/property list:", err);
  }

  res.status(200).render("contact", {
    pageTitle: "Contact",
    path: "/contact",
    myBookings,
    myProperties,
  });
};

export const contactController = { contact };
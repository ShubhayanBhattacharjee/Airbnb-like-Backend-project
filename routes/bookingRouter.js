import express from "express";
import { bookingController } from "../controllers/bookingController.js";

const bookingRouter = express.Router();
const isLoggedIn = (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    next();
};

bookingRouter.get("/",                isLoggedIn, bookingController.getBookings);
bookingRouter.get("/check-availability", bookingController.checkAvailability);
bookingRouter.post("/create-order",   isLoggedIn, bookingController.createOrder);
bookingRouter.post("/verify-payment", isLoggedIn, bookingController.verifyPayment);
bookingRouter.get("/confirmation/:id",isLoggedIn, bookingController.getConfirmation);
bookingRouter.post("/cancel/:id",     isLoggedIn, bookingController.cancelBooking);

export default bookingRouter;
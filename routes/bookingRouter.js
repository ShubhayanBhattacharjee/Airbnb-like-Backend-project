import express from "express";
import { bookingController } from "../controllers/bookingController.js";

const bookingRouter = express.Router();
const isLoggedIn = (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    next();
};
const isLoggedInJson = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Please log in" });
    next();
};

bookingRouter.get("/",                isLoggedIn, bookingController.getBookings);

bookingRouter.get("/check-availability", bookingController.checkAvailability);
bookingRouter.post("/create-order",   isLoggedInJson, bookingController.createOrder);
bookingRouter.post("/verify-payment", isLoggedInJson, bookingController.verifyPayment);
bookingRouter.get("/confirmation/:id",isLoggedIn, bookingController.getConfirmation);
bookingRouter.post("/cancel/:id",     isLoggedIn, bookingController.cancelBooking);

bookingRouter.post("/:id/modify/quote",   isLoggedInJson, bookingController.getModificationQuote);
bookingRouter.post("/:id/modify/confirm", isLoggedInJson, bookingController.confirmModification);
bookingRouter.get("/:id/invoice", isLoggedIn, bookingController.downloadInvoice);

bookingRouter.post("/webhook", bookingController.razorpayWebhook);

export default bookingRouter;
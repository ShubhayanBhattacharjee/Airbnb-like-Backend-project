import express from "express";
import { inquiryController } from "../controllers/inquiryController.js";

const inquiryRouter = express.Router();

const isLoggedIn = (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    next();
};
const isHost = (req, res, next) => {
    if (!req.user || req.user.role !== "host") return res.status(403).send("Forbidden");
    next();
};

inquiryRouter.post("/inquiries/ask", isLoggedIn, inquiryController.postAskQuestion);
inquiryRouter.get("/host/inquiries", isLoggedIn, isHost, inquiryController.listMyInquiries);
inquiryRouter.post("/host/inquiries/:id/reply", isLoggedIn, isHost, inquiryController.postReplyInquiry);

export default inquiryRouter;
import express from "express";
import { postReview, getHomeReviews,postHostReply,editReview,deleteReview } from "../controllers/reviewController.js";

const reviewRouter = express.Router();
const isLoggedIn = (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    next();
};
const isHost = (req, res, next) => {
    if (!req.user || req.user.role !== "host") return res.status(403).send("Hosts only");
    next();
};

reviewRouter.post("/submit", isLoggedIn, postReview);
reviewRouter.get("/home/:homeId", getHomeReviews);
reviewRouter.post("/reply/:reviewId", isLoggedIn, isHost, postHostReply);  
reviewRouter.post("/edit/:reviewId", isLoggedIn, editReview);  
reviewRouter.post("/delete/:reviewId",isLoggedIn, deleteReview);  

export default reviewRouter;
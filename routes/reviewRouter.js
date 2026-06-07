import express from "express";
import { postReview, getHomeReviews } from "../controllers/reviewController.js";

const reviewRouter = express.Router();
const isLoggedIn = (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    next();
};

reviewRouter.post("/submit", isLoggedIn, postReview);
reviewRouter.get("/home/:homeId", getHomeReviews);

export default reviewRouter;
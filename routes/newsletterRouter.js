import express from "express";
import { newsletterController } from "../controllers/newsletterController.js";
import { contactLimiter } from "../middlewares/rateLimit.js";

const newsletterRouter = express.Router();

newsletterRouter.post("/newsletter/subscribe", contactLimiter, newsletterController.subscribe);
newsletterRouter.get("/newsletter/unsubscribe", newsletterController.unsubscribe);

export default newsletterRouter;
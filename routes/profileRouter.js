import express from "express";
import { profileController } from "../controllers/profileController.js";
import upload from "../middlewares/upload.js";

const profileRouter = express.Router();
const isLoggedIn = (req,res,next)=>{
    if(!req.user){
        return res.redirect("/login");
    }
    next();
}

profileRouter.get('/profile', isLoggedIn, profileController.getProfile);
profileRouter.post('/profile', isLoggedIn, profileController.postProfile);
profileRouter.post('/profile/become-host', isLoggedIn, profileController.postBecomeHost);
profileRouter.post('/profile/toggle-2fa', isLoggedIn, profileController.postToggle2FA);
profileRouter.post("/profile/delete",isLoggedIn,profileController.deleteProfile);

export default profileRouter;

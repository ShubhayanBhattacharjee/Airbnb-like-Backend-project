import express from "express";
import { storeController } from "../controllers/storeController.js";

const storeRouter = express.Router();
const isLoggedIn = (req,res,next)=>{
    if(!req.user){
        return res.redirect("/login");
    }
    next();
}

storeRouter.get('/',storeController.getHome);
storeRouter.get('/bookings',storeController.getBookings);
storeRouter.get("/favourites",isLoggedIn,storeController.getFavourites);
storeRouter.post("/favourites",isLoggedIn,storeController.postAddFav);
storeRouter.post("/favourites/delete/:homeId",isLoggedIn,storeController.postRemoveFav);
storeRouter.get('/homeList',storeController.gethomeList);
storeRouter.get('/homeList/:homeId',storeController.gethomeDetails);

export default storeRouter;

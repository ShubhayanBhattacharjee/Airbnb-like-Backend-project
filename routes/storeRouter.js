import express from "express";
import { storeController } from "../controllers/storeController.js";

const storeRouter = express.Router();

storeRouter.get('/',storeController.getHome);
storeRouter.get('/bookings',storeController.getBookings);
storeRouter.get('/favourites',storeController.getFavourites);
storeRouter.post('/favourites',storeController.postAddFav);
storeRouter.post('/favourites/delete/:homeId', storeController.postRemoveFav);
storeRouter.get('/homeList',storeController.gethomeList);
storeRouter.get('/homeList/:homeId',storeController.gethomeDetails);

export default storeRouter;

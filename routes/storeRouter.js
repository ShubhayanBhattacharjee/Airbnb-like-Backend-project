import express from "express";
import { storeController } from "../controllers/storeController.js";

const storeRouter = express.Router();

storeRouter.get('/',storeController.getHome);
storeRouter.get('/bookings',storeController.getBookings);
storeRouter.get('/favourites',storeController.getFavourites);
storeRouter.get('/homeList',storeController.gethomeList);

export default storeRouter;

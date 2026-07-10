import express from "express";
import {hostController} from '../controllers/hostController.js';
import upload from "../middlewares/upload.js";

const hostRouter = express.Router();

hostRouter.get('/addHome',hostController.getaddHome); 
hostRouter.post('/addHome',upload.single('photo'),hostController.postaddHome);
hostRouter.get('/hostHomeList',hostController.hostHomeList);
hostRouter.get('/editHome/:homeId',hostController.getEditHome);
hostRouter.post('/editHome/:homeId', upload.array('photos', 8), hostController.postEditHome);
hostRouter.post('/deleteHome/:homeId',hostController.postDeleteHome);
hostRouter.get("/manage-dates/:homeId",hostController.getManageDates);
hostRouter.post("/block-dates", hostController.postBlockDates);
hostRouter.post("/unblock-dates/:homeId/:blockId", hostController.postUnblockDate);
hostRouter.get('/dashboard', hostController.getDashboard);

export { hostRouter};


 
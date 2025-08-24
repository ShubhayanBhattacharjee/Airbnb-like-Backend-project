import express from "express";
import {hostController} from '../controllers/hostController.js';

const hostRouter = express.Router();

hostRouter.get('/addHome',hostController.getaddHome); 
hostRouter.post('/addHome',hostController.postaddHome);
hostRouter.get('/hostHomeList',hostController.hostHomeList);
hostRouter.get('/editHome/:homeId',hostController.getEditHome);
hostRouter.post('/editHome/:homeId',hostController.postEditHome);
hostRouter.post('/deleteHome/:homeId',hostController.postDeleteHome);

export { hostRouter};


 
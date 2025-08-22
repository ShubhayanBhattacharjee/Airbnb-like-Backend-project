import express from "express";
import {hostController} from '../controllers/hostController.js';

const hostRouter = express.Router();

hostRouter.get('/addHome',hostController.getaddHome); 
hostRouter.post('/addHome',hostController.postaddHome);
hostRouter.get('/hostHomeList',hostController.hostHomeList);
export { hostRouter};



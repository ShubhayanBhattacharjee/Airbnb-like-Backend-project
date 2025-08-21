import express from "express";
import {homeController} from '../controllers/homes.js';

const hostRouter = express.Router();

hostRouter.get('/addHome',homeController.getaddHome); 
hostRouter.post('/addHome',homeController.postaddHome);

export { hostRouter};



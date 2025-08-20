// module.exports=hostRouter;
import path from "path";
import express from "express";
import { dirname } from "path";
import { fileURLToPath } from 'url';
import {getaddHome} from '../controllers/home.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hostRouter = express.Router();

// GET route to serve the add-home form
hostRouter.get('/addHome',getaddHome); 

// POST route to handle the form submission
const registeredHomes=[]
hostRouter.post('/addHome', (req, res, next) => {
    console.log("Home resgistered successful for : ",req.body,req.body.houseName); // logs submitted form data
    const houseName=req.body.houseName;
    registeredHomes.push({houseName});
    // res.sendFile(path.join(__dirname, "../views","homeAdded.html"));
    res.render('homeAdded', { pageTitle: 'Home Added', houseName: houseName });
});

export { hostRouter, registeredHomes };


//this routers don't have their listen proeprty they can't directly listen to the requests coming  in from the users 
//they can only works as sub servers under the main server 
//like userRouter is working as a sub app to the main app

import express from "express";
import path from "path"; 
import { dirname } from "path";
import { fileURLToPath } from 'url';
import { registeredHomes } from "./hostRouter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const userRouter = express.Router();

userRouter.get('/', (req, res, next) => {
    // console.log(registeredHomes);
    // res.sendFile(path.join(__dirname, '../views/index.html')); 
    res.render("index",{registeredHomes:registeredHomes,pageTitle:"Home page"});
});

export default userRouter;

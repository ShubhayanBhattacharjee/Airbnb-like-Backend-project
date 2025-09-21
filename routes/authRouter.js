import express from "express";
import { authController } from "../controllers/authController.js";

const authRouter = express.Router();

authRouter.get('/login',authController.getLogin);
authRouter.post('/login',authController.postLogin);


export default authRouter;

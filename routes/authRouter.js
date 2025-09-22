import express from "express";
import { authController } from "../controllers/authController.js";

const authRouter = express.Router();

authRouter.get('/login',authController.getLogin);
authRouter.post('/login',authController.postLogin);
authRouter.post('/logout',authController.postLogout);
authRouter.get('/signup',authController.getSignup);
authRouter.post('/signup',authController.postSignup);

export default authRouter;

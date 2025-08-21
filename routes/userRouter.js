import express from "express";
import { homeController } from "../controllers/homes.js";

const userRouter = express.Router();

userRouter.get('/',homeController.getHome);

export default userRouter;

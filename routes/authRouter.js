import express from "express";
import { authController } from "../controllers/authController.js";
import { loginLimiter,forgotPasswordLimiter,otpVerifyLimiter, otpResendLimiter } from "../middlewares/rateLimit.js";

const authRouter = express.Router();

authRouter.get("/verify-email/:token",authController.verifyEmail);

authRouter.get('/login',authController.getLogin);
authRouter.post('/login', loginLimiter, authController.postLogin);

authRouter.post('/logout',authController.postLogout);

authRouter.get('/login/verify-2fa', authController.getVerify2FA);
authRouter.post('/login/verify-2fa', otpVerifyLimiter, authController.postVerify2FA);
authRouter.post('/login/resend-2fa-otp', otpResendLimiter, authController.resendLoginOtp);

authRouter.get('/signup',authController.getSignup);
authRouter.post('/signup', authController.postSignup);

authRouter.get('/forgot-password', authController.getForgotPassword);
authRouter.post('/forgot-password',forgotPasswordLimiter, authController.postForgotPassword);

authRouter.get('/verify-otp', authController.getVerifyOtp);
authRouter.post('/verify-otp', otpVerifyLimiter, authController.postVerifyOtp);
authRouter.post('/resend-otp', otpResendLimiter, authController.resendOtp);

authRouter.get('/reset-password', authController.getResetPassword);
authRouter.post('/reset-password', authController.postResetPassword);

authRouter.get('/complete-profile', authController.getCompleteProfile);
authRouter.post('/complete-profile', authController.postCompleteProfile);

export default authRouter;
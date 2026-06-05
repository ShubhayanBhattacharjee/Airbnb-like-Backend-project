import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import path from "path";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import User from "../models/user.js";

const getSignup = (req, res, next) => {
    res.render("auth/signup", {
        pageTitle: 'Register',
        isLoggedIn: false,
        user:{}
    });
}

const getLogin = (req, res, next) => {
    res.render("auth/login", {
        pageTitle: 'Login',
        isLoggedIn: false,
        errors:[],
        oldInput:{email:""},
        user:{},
    });
}

const postSignup = [
    // First Name
    check("fname")
        .notEmpty().withMessage("First name is required")
        .trim()
        .isLength({ min: 2 }).withMessage("First name must be at least 2 characters long")
        .matches(/^[a-zA-Z\s]+$/).withMessage("First name can only contain letters"),

    // Middle Name (optional, just trim if present)
    check("mname").optional().trim(),

    // Last Name
    check("lname")
        .notEmpty().withMessage("Last name is required")
        .trim()
        .isLength({ min: 2 }).withMessage("Last name must be at least 2 characters long")
        .matches(/^[a-zA-Z\s]+$/).withMessage("Last name can only contain letters"),

    // Email
    check("email")
    .isEmail()
    .normalizeEmail()
    .custom(async (value)=>{
        const user = await User.findOne({email:value});
        if(user){
            throw new Error("Email already exists");
        }
        return true;
    }),

    // Password
    check("password")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
        .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
        .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
        .matches(/[0-9]/).withMessage("Password must contain at least one number")
        .matches(/[!@#$%^&*(),.?\":{}|<>]/)
        .withMessage("Password must contain at least one special character"),

    // Confirm Password
    check("Cpassword")
        .trim()
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error("Passwords do not match");
            }
            return true;
        }),

    // Role
    check("role")
        .notEmpty().withMessage("Role is required")
        .isIn(["guest", "host"]).withMessage("Invalid role"),

    // Terms checkbox
    check("terms")
        .equals("accepted").withMessage("You must accept the terms and conditions"),

    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render("auth/signup", {
                pageTitle: "Register",
                isLoggedIn: false,
                errors: errors.array().map(err => err.msg),
                oldInput: req.body,
                user: {}
            });
        }
        try {
            const token = crypto.randomBytes(32).toString("hex");
            const {
                fname,
                mname,
                lname,
                email,
                password,
                role,
                location,
                country,
                phone,
                bio
            } = req.body;
            let profileImage = "/images/about-hero.png";
            if (req.file) {
                const type = await fileTypeFromBuffer(req.file.buffer);
                if (
                    !type ||
                    !["image/jpeg", "image/png"].includes(type.mime)
                ) {
                    return res.status(422).render("auth/signup", {
                        pageTitle: "Register",
                        isLoggedIn: false,
                        errors: ["Only JPG and PNG images are allowed"],
                        oldInput: req.body,
                        user: {}
                    });
                }
                const filename =
                    Date.now() +
                    "-" +
                    Math.random().toString(36).substring(2) +
                    ".jpg";
                await sharp(req.file.buffer)
                    .resize(300, 300)
                    .jpeg({ quality: 80 })
                    .toFile(
                        path.join("uploads", filename)
                    );
                profileImage = "/uploads/" + filename;
            }
            const hashedPassword =
                await bcrypt.hash(password, 12);
            const user = new User({
                fname,
                mname,
                lname,
                email,
                password: hashedPassword,
                role,
                profileImage,
                location,
                country,
                phone,
                bio,
                verificationToken: token,
                verificationTokenExpires:
                    Date.now() + 24 * 60 * 60 * 1000
            });
            await user.save();
            try {
                await sendEmail(
                    email,
                    "Verify your account",
                    `
                    <h2>Welcome to Airbnb Clone</h2>
                    <p>Please verify your account:</p>
                    <a href="http://localhost:3000/verify-email/${token}">
                        Verify Email
                    </a>
                    `
                );
                console.log("✅ Verification email sent to", email);
            } catch (emailErr) {
                console.error("❌ Email send failed:", emailErr.message);
            }
            res.redirect("/login");
        } catch (err) {
            return res.status(422).render("auth/signup", {
                pageTitle: "Register",
                isLoggedIn: false,
                errors: [err.message],
                oldInput: req.body,
                user: {}
            });
        }
    }];

const postLogin = async (req, res, next) => {
    const {email,password}=req.body;
    const user=await User.findOne({email:email});
    if(!user){
        return res.status(422).render("auth/login", {
                pageTitle: "Login",
                isLoggedIn: false,
                errors:["User does not exist"],
                oldInput:{email},
                user:{}
            });
    }
    if(!user.isVerified){
        return res.status(403).render(
            "auth/login",
            {
                pageTitle:"Login",
                isLoggedIn:false,
                errors:[
                    "Please verify your email first."
                ],
                oldInput:{email},
                user:{}
            }
        );
    }
    const isMatch=await bcrypt.compare(password,user.password);
    if(!isMatch){
        return res.status(422).render("auth/login", {
                pageTitle: "Login",
                isLoggedIn: false,
                errors:["Invalid credentials"],
                oldInput:{email},
                user:{}
            });
    }
    req.session.regenerate(err => {
        if(err){
            console.log(err);
            return res.redirect("/login");
        }
        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.save(err => {
            if(err){
                console.log(err);
            }
            res.redirect("/");
        });
    });
};


const postLogout = (req, res, next) => {
    req.session.destroy(err=>{
    if(err){
        console.log(err);
        return res.redirect("/");
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
});
}

const verifyEmail = async (req,res,next)=>{
    try{
        const token = req.params.token;
        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires:{
                $gt: Date.now()
            }
        });
        if(!user){
            return res.status(400).send(
                "Invalid or expired token"
            );
        }
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();
        res.redirect("/login");
    }catch(err){
        next(err);
    }
}

const getForgotPassword = (req, res) => {
    res.render("auth/forgotPassword", {
        pageTitle: "Forgot Password",
        errors: [],
        message: null
    });
};

const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Never reveal if email exists
            return res.render("auth/forgotPassword", {
                pageTitle: "Forgot Password",
                errors: [],
                message: "If that email is registered, a 6-digit code has been sent."
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        try {
            await sendEmail(
                email,
                "Your password reset code",
                `
                <h2>Password Reset Code</h2>
                <p>Your 6-digit code is:</p>
                <h1 style="letter-spacing:8px">${otp}</h1>
                <p>This code expires in <strong>10 minutes</strong>.</p>
                <p>If you didn't request this, ignore this email.</p>
                `
            );
            console.log("✅ OTP sent to", email);
        } catch (emailErr) {
            console.error("❌ OTP email failed:", emailErr.message);
        }

        // Store email in session to use in next steps
        req.session.resetEmail = email;

        res.redirect("/verify-otp");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

const getVerifyOtp = (req, res) => {
    if (!req.session.resetEmail) {
        return res.redirect("/forgot-password");
    }
    res.render("auth/verifyOtp", {
        pageTitle: "Enter Code",
        errors: []
    });
};

const postVerifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.resetEmail;

        if (!email) return res.redirect("/forgot-password");

        const user = await User.findOne({ email });

        // Check if OTP is expired
        if (!user || !user.resetOtp || user.resetOtpExpires < Date.now()) {
            return res.render("auth/verifyOtp", {
                pageTitle: "Enter Code",
                errors: ["Code has expired. Please request a new one."]
            });
        }

        // Check attempt limit (max 5)
        if (user.resetOtpAttempts >= 5) {
            // Invalidate OTP completely
            user.resetOtp = undefined;
            user.resetOtpExpires = undefined;
            user.resetOtpAttempts = 0;
            await user.save();
            delete req.session.resetEmail;

            return res.render("auth/forgotPassword", {
                pageTitle: "Forgot Password",
                errors: ["Too many failed attempts. Please request a new code."],
                message: null
            });
        }

        // Wrong OTP
        if (user.resetOtp !== otp) {
            user.resetOtpAttempts += 1;
            await user.save();

            const attemptsLeft = 5 - user.resetOtpAttempts;
            return res.render("auth/verifyOtp", {
                pageTitle: "Enter Code",
                errors: [`Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`]
            });
        }

        // OTP correct — reset attempts
        user.resetOtpAttempts = 0;
        await user.save();

        req.session.otpVerified = true;
        res.redirect("/reset-password");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

const getResetPassword = (req, res) => {
    if (!req.session.resetEmail || !req.session.otpVerified) {
        return res.redirect("/forgot-password");
    }
    res.render("auth/resetPassword", {
        pageTitle: "New Password",
        errors: []
    });
};

const postResetPassword = async (req, res) => {
    try {
        const { password, Cpassword } = req.body;
        const email = req.session.resetEmail;

        if (!email || !req.session.otpVerified) {
            return res.redirect("/forgot-password");
        }

        if (password !== Cpassword) {
            return res.render("auth/resetPassword", {
                pageTitle: "New Password",
                errors: ["Passwords do not match"]
            });
        }

        if (password.length < 8) {
            return res.render("auth/resetPassword", {
                pageTitle: "New Password",
                errors: ["Password must be at least 8 characters"]
            });
        }

        const user = await User.findOne({ email });
        if (!user) return res.redirect("/forgot-password");

        user.password = await bcrypt.hash(password, 12);
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();

        // Clean up session
        delete req.session.resetEmail;
        delete req.session.otpVerified;

        console.log("Password reset for", email);
        res.redirect("/login");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

const getCompleteProfile = (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    res.render("auth/completeProfile", {
        pageTitle: "Complete Your Profile",
        errors: []
    });
};

const postCompleteProfile = async (req, res) => {
    try {
        const { role, phone, location, country, bio } = req.body;

        if (!["guest", "host"].includes(role)) {
            return res.render("auth/completeProfile", {
                pageTitle: "Complete Your Profile",
                errors: ["Please select a valid role"]
            });
        }

        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect("/login");

        user.role = role;
        user.phone = phone || "";
        user.location = location || "";
        user.country = country || "";
        user.bio = bio || "";
        user.needsRole = false;
        await user.save();

        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

export const authController = { getSignup, getLogin, postSignup, postLogin, postLogout, verifyEmail, getForgotPassword, postForgotPassword,getVerifyOtp, postVerifyOtp,getResetPassword, postResetPassword,getCompleteProfile, postCompleteProfile };

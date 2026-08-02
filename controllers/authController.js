import dotenv from "dotenv";
dotenv.config();
import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/user.js";
import { sendEmail } from "../utils/sendEmail.js";
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js';
import { ensureHostId } from '../utils/sequence.js';

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
    .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false
    }).custom(async (value)=>{
        const user = await User.findOne({email:value});
        if(user){
            throw new Error("Email already exists");
        }
        return true;
    }),

    // Phone (optional, but if given it can't already belong to another account)
    check("phone")
        .optional({ checkFalsy: true })
        .trim()
        .custom(async (value) => {
            const user = await User.findOne({ phone: value });
            if (user) {
                throw new Error("That phone number is already registered to another account");
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
            let profileImage = "";
            if (req.file) {
                try {
                    profileImage = await uploadToCloudinary(
                        req.file.buffer,
                        'Roovia/profiles',
                        300, 300
                    );
                } catch (uploadErr) {
                    return res.status(422).render("auth/signup", {
                        pageTitle: "Register",
                        isLoggedIn: false,
                        errors: [uploadErr.message],
                        oldInput: req.body,
                        user: {}
                    });
                }
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
                isVerified: true,
                verificationToken: token,
                verificationTokenExpires:
                    Date.now() + 24 * 60 * 60 * 1000
            });
            await ensureHostId(user);
            await user.save();

            sendEmail(
                email,
                "Verify your account",
                `
                <h2>Welcome to Roovia</h2>
                <p>Please verify your account:</p>
                <a href="${process.env.APP_URL}/verify-email/${token}">
                    Verify Email
                </a>
                `
            ).catch(emailErr => console.error("Signup verification email failed:", emailErr.message));

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
    try {
        const { password } = req.body;
        const email = req.body.email?.trim().toLowerCase();
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(422).render("auth/login", {
                pageTitle: "Login",
                isLoggedIn: false,
                errors: ["User does not exist"],
                oldInput: { email },
                user: {}
            });
        }
        if (user.loginLockUntil && user.loginLockUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.loginLockUntil - Date.now()) / 60000);
            return res.status(429).render("auth/login", {
                pageTitle: "Login",
                isLoggedIn: false,
                errors: [`Account locked. Try again in ${minutesLeft} minute(s).`],
                oldInput: { email },
                user: {}
            });
        }
        // if (!user.isVerified) {
        //     return res.status(403).render("auth/login", {
        //         pageTitle: "Login",
        //         isLoggedIn: false,
        //         errors: ["Please verify your email first."],
        //         oldInput: { email },
        //         user: {}
        //     });
        // }
        if (user.isBanned) {
            return res.status(403).render("auth/login", {
                pageTitle: "Login",
                isLoggedIn: false,
                errors: [`Your account has been suspended. Reason: ${user.banReason}`],
                oldInput: { email },
                user: {}
            });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= 5) {
                user.loginLockUntil = new Date(Date.now() + 15 * 60 * 1000);
                user.loginAttempts = 0;
                await user.save();
                return res.status(429).render("auth/login", {
                    pageTitle: "Login",
                    isLoggedIn: false,
                    errors: ["Too many failed attempts. Account locked for 15 minutes."],
                    oldInput: { email },
                    user: {}
                });
            }
            await user.save();
            const attemptsLeft = 5 - user.loginAttempts;
            return res.status(422).render("auth/login", {
                pageTitle: "Login",
                isLoggedIn: false,
                errors: [`Invalid credentials. ${attemptsLeft} attempt(s) remaining.`],
                oldInput: { email },
                user: {}
            });
        }
        user.loginAttempts = 0;
        user.loginLockUntil = undefined;
        await user.save();

        // If the account has 2FA turned on, don't log them in yet —
        // send an OTP to their email and park them on the verify-2fa step.
        if (user.twoFactorEnabled) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.loginOtp = otp;
            user.loginOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
            user.loginOtpAttempts = 0;
            await user.save();
            try {
                await sendEmail(
                    email,
                    "Your login verification code",
                    `
                    <h2>Login Verification Code</h2>
                    <p>Your 6-digit code is:</p>
                    <h1 style="letter-spacing:8px">${otp}</h1>
                    <p>This code expires in <strong>10 minutes</strong>.</p>
                    <p>If this wasn't you, please secure your account immediately.</p>
                    `
                );
            } catch (emailErr) {
                return next(emailErr);
            }
            return req.session.regenerate(err => {
                if (err) {
                    console.log(err);
                    return res.redirect("/login");
                }
                req.session.pending2FAUserId = user._id.toString();
                req.session.save(err => {
                    if (err) console.log(err);
                    res.redirect("/login/verify-2fa");
                });
            });
        }

        req.session.regenerate(err => {
            if (err) {
                console.log(err);
                return res.redirect("/login");
            }
            req.session.isLoggedIn = true;
            req.session.userId = user._id;
            req.session.save(err => {
                if (err) console.log(err);
                res.redirect("/");
            });
        });
    } catch (err) {
        next(err);
    }
};

const getVerify2FA = (req, res) => {
    if (!req.session.pending2FAUserId) {
        return res.redirect("/login");
    }
    const message = req.session.twoFAMessage || null;
    delete req.session.twoFAMessage;
    res.render("auth/verify2FA", {
        pageTitle: "Verify Login",
        errors: [],
        message
    });
};

const postVerify2FA = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.session.pending2FAUserId;
        if (!userId) return res.redirect("/login");
        const user = await User.findById(userId);
        if (!user || !user.loginOtp || user.loginOtpExpires < Date.now()) {
            return res.render("auth/verify2FA", {
                pageTitle: "Verify Login",
                errors: ["Code has expired. Please request a new one."],
                message: null,
                otpResult: "wrong"
            });
        }
        if (user.loginOtpAttempts >= 5) {
            user.loginOtp = undefined;
            user.loginOtpExpires = undefined;
            user.loginOtpAttempts = 0;
            await user.save();
            delete req.session.pending2FAUserId;
            return res.redirect("/login");
        }
        if (user.loginOtp !== otp) {
            user.loginOtpAttempts += 1;
            await user.save();
            const attemptsLeft = 5 - user.loginOtpAttempts;
            return res.render("auth/verify2FA", {
                pageTitle: "Verify Login",
                errors: [`Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`],
                message: null,
                otpResult: "wrong"
            });
        }
        user.loginOtp = undefined;
        user.loginOtpExpires = undefined;
        user.loginOtpAttempts = 0;
        await user.save();
        delete req.session.pending2FAUserId;
        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.save(err => {
            if (err) console.log(err);
            return res.render("auth/verify2FA", {
                pageTitle: "Verify Login",
                errors: [],
                message: null,
                otpResult: "correct"
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

const resendLoginOtp = async (req, res) => {
    try {
        const userId = req.session.pending2FAUserId;
        if (!userId) return res.redirect("/login");
        const user = await User.findById(userId);
        if (!user) return res.redirect("/login");

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.loginOtp = otp;
        user.loginOtpExpires = Date.now() + 10 * 60 * 1000;
        user.loginOtpAttempts = 0;
        await user.save();

        try {
            await sendEmail(
                user.email,
                "Your login verification code",
                `
                <h2>Login Verification Code</h2>
                <p>Your 6-digit code is:</p>
                <h1 style="letter-spacing:8px">${otp}</h1>
                <p>This code expires in <strong>10 minutes</strong>.</p>
                <p>If this wasn't you, please secure your account immediately.</p>
                `
            );
        } catch (emailErr) {
            console.error(emailErr);
            return res.render("auth/verify2FA", {
                pageTitle: "Verify Login",
                errors: ["Couldn't send the code right now. Please try again in a moment."],
                message: null
            });
        }

        req.session.twoFAMessage = "A new code has been sent to your email.";
        res.redirect("/login/verify-2fa");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
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
        const email = req.body.email?.trim().toLowerCase();
        const user = await User.findOne({ email });

        if (!user) {
            return res.render("auth/forgotPassword", {
                pageTitle: "Forgot Password",
                errors: [],
                message: "If that email is registered, a 6-digit code has been sent."
            });
        }
       const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        sendEmail(
            email,
            "Your password reset code",
            `
            <h2>Password Reset Code</h2>
            <p>Your 6-digit code is:</p>
            <h1 style="letter-spacing:8px">${otp}</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, ignore this email.</p>
            `
        ).catch(emailErr => console.error("Password reset email failed:", emailErr.message));

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
    const message = req.session.otpMessage || null;
    delete req.session.otpMessage;
    res.render("auth/verifyOtp", {
        pageTitle: "Enter Code",
        errors: [],
        message
    });
};

const postVerifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.resetEmail;
        if (!email) return res.redirect("/forgot-password");
        const user = await User.findOne({ email });
        if (!user || !user.resetOtp || user.resetOtpExpires < Date.now()) {
            return res.render("auth/verifyOtp", {
                pageTitle: "Enter Code",
                errors: ["Code has expired. Please request a new one."],
                message: null,
                otpResult: "wrong"
            });
        }
        if (user.resetOtpAttempts >= 5) {
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
        if (user.resetOtp !== otp) {
            user.resetOtpAttempts += 1;
            await user.save();
            const attemptsLeft = 5 - user.resetOtpAttempts;
            return res.render("auth/verifyOtp", {
                pageTitle: "Enter Code",
                errors: [`Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`],
                message: null,
                otpResult: "wrong"
            });
        }
        user.resetOtpAttempts = 0;
        await user.save();
        req.session.otpVerified = true;
        return res.render("auth/verifyOtp", {
            pageTitle: "Enter Code",
            errors: [],
            message: null,
            otpResult: "correct"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

const resendOtp = async (req, res) => {
    try {
        const email = req.session.resetEmail;
        if (!email) return res.redirect("/forgot-password");

        const user = await User.findOne({ email });
        if (!user) return res.redirect("/forgot-password");

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        user.resetOtpAttempts = 0;
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
        } catch (emailErr) {
            console.error(emailErr);
            return res.render("auth/verifyOtp", {
                pageTitle: "Enter Code",
                errors: ["Couldn't send the code right now. Please try again in a moment."],
                message: null
            });
        }

        req.session.otpMessage = "A new code has been sent to your email.";
        res.redirect("/verify-otp");
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

        // Block reuse of the current password or any of the last few passwords.
        const PASSWORD_HISTORY_LIMIT = 5;
        const previousHashes = [user.password, ...(user.passwordHistory || [])].filter(Boolean);
        for (const oldHash of previousHashes) {
            const isReused = await bcrypt.compare(password, oldHash);
            if (isReused) {
                return res.render("auth/resetPassword", {
                    pageTitle: "New Password",
                    errors: ["You've already used this password. Please choose a new one."]
                });
            }
        }

        if (user.password) {
            user.passwordHistory = [user.password, ...(user.passwordHistory || [])].slice(0, PASSWORD_HISTORY_LIMIT);
        }
        user.password = await bcrypt.hash(password, 12);
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();
        delete req.session.resetEmail;
        delete req.session.otpVerified;
        res.redirect("/login");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

const getCompleteProfile = async (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");
    res.render("auth/completeProfile", {
        pageTitle: "Complete Your Profile",
        errors: [],
        user,
        oldInput: {}
    });
};

const postCompleteProfile = [
    check("password")
        .optional({ checkFalsy: true })
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
        .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
        .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
        .matches(/[0-9]/).withMessage("Password must contain at least one number")
        .matches(/[!@#$%^&*(),.?\":{}|<>]/).withMessage("Password must contain at least one special character"),

    check("Cpassword")
        .optional({ checkFalsy: true })
        .custom((value, { req }) => {
            if (req.body.password && value !== req.body.password) {
                throw new Error("Passwords do not match");
            }
            return true;
        }),

    // Phone (optional, but if given it can't already belong to another account)
    check("phone")
        .optional({ checkFalsy: true })
        .trim()
        .custom(async (value, { req }) => {
            const existing = await User.findOne({ phone: value });
            if (existing && existing._id.toString() !== req.session.userId) {
                throw new Error("That phone number is already registered to another account");
            }
            return true;
        }),

    async (req, res) => {
        const { role, phone, location, country, bio, mname, password } = req.body;
        const rerender = async (errors) => {
            const user = await User.findById(req.session.userId);
            return res.status(422).render("auth/completeProfile", {
                pageTitle: "Complete Your Profile",
                errors,
                user: user || {},
                oldInput: req.body
            });
        };

        if (!["guest", "host"].includes(role)) {
            return rerender(["Please select a valid role"]);
        }

        const validation = validationResult(req);
        if (!validation.isEmpty()) {
            return rerender(validation.array().map(e => e.msg));
        }

        try {
            const user = await User.findById(req.session.userId);
            if (!user) return res.redirect("/login");

            if (req.file) {
                try {
                    user.profileImage = await uploadToCloudinary(
                        req.file.buffer,
                        'Roovia/profiles',
                        300, 300
                    );
                } catch (uploadErr) {
                    return rerender([uploadErr.message]);
                }
            }

            if (password) {
                user.password = await bcrypt.hash(password, 12);
            }

            user.mname = mname || user.mname;
            user.role = role;
            user.phone = phone || "";
            user.location = location || "";
            user.country = country || "";
            user.bio = bio || "";
            user.needsRole = false;
            await ensureHostId(user);
            await user.save();
            res.redirect("/");
        } catch (err) {
            console.error(err);
            res.status(500).send("Server error");
        }
    }
];

export const authController = { getSignup, getLogin, postSignup, postLogin, postLogout, verifyEmail, getForgotPassword, postForgotPassword,getVerifyOtp, postVerifyOtp, resendOtp, getResetPassword, postResetPassword,getCompleteProfile, postCompleteProfile, getVerify2FA, postVerify2FA, resendLoginOtp };
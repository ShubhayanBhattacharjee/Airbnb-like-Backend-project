import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import path from "path";
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
                bio
            });
            await user.save();
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

export const authController = { getSignup, getLogin, postSignup, postLogin, postLogout };
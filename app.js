import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from 'url';
import mongoose from "mongoose";
import connectMongoDBSession from 'connect-mongodb-session';
import session from "express-session";
import multer from "multer";
import helmet from "helmet";
import csrf from "csurf";

import authRouter from "./routes/authRouter.js";
import storeRouter from "./routes/storeRouter.js";
import { hostRouter} from "./routes/hostRouter.js";
import bookingRouter from "./routes/bookingRouter.js";
import reviewRouter from "./routes/reviewRouter.js";
import adminRouter from "./routes/adminRouter.js";
import { errorController } from "./controllers/error.js";
import { contactController } from "./controllers/contact.js";
import { aboutController } from "./controllers/about.js";
import { hostsController } from "./controllers/hosts.js";
import passport from "./config/passport.js";
import Booking from "./models/booking.js";
import User from "./models/user.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app=express();
const port=3000;
const DB_PATH = process.env.MONGODB_URI;

const MongoDBStore = connectMongoDBSession(session);
const store = new MongoDBStore({
  uri: DB_PATH,
  collection: 'sessions',
  connectionOptions: {
    tls: true,
    tlsAllowInvalidCertificates: true
  }
});
const csrfProtection = csrf({
    value: (req) =>
        (req.body && req.body._csrf) ||
        req.headers['csrf-token'] ||
        req.headers['x-csrf-token']
});

app.set('view engine','ejs');
app.set('views',path.join(__dirname, "views")); 

const fileFilter = (req,file,cb)=>{
    if(
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png"
    ){
        cb(null,true);
    }else{
        cb(null,false);
    }
};
const storage = multer.memoryStorage();
const multerOptions={
    storage, fileFilter, 
    limits: {
        fileSize: 2 * 1024 * 1024
    }
};
app.use(helmet({contentSecurityPolicy: false}));
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(multer(multerOptions).single('photo'));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie:{
        maxAge: 24*60*60*1000,
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:'lax'
    }
  })
);
app.use(passport.initialize());
app.use(passport.session()); 
app.use(csrfProtection);
app.use((req,res,next)=>{
    res.locals.csrfToken = req.csrfToken();
    next();
});
app.use(async (req,res,next)=>{
    try{
        if(!req.session.userId){
            return next();
        }
        const user = await User.findById(req.session.userId);
        if(!user){
            return next();
        }
        req.user = user;
        next();
    }catch(err){
        console.log(err);
        next(err);
    }
});
app.use((req,res,next)=>{
    res.locals.user = req.user || null;
    res.locals.isLoggedIn = req.session.isLoggedIn && !!req.user;
    next();
});
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    (req, res) => {
        req.session.userId = req.user._id.toString();
        req.session.isLoggedIn = true;
        req.session.save(err => {
            if (err) {
                return res.redirect("/login");
            }
            if (req.user.needsRole) {
                return res.redirect("/complete-profile");
            }
            res.redirect("/");
        });
    }
);
app.use("/admin", adminRouter); 
app.use(authRouter);
app.use("/",storeRouter);
app.use("/bookings", bookingRouter);
app.use("/reviews", reviewRouter);
app.use("/host",(req,res,next)=>{
    if(!req.session.isLoggedIn){
        return res.redirect("/login");
    }
    if(!req.user || req.user.role !== "host"){
        return res.status(403).send("Hosts only");
    }
    next();
});
app.use("/host",hostRouter);
app.use("/contact",contactController.contact);
app.use("/about",aboutController.about);
app.use("/hosts",hostsController.hosts);
app.use(errorController.pageNotFound);
app.use((err, req, res, next) => {
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).render("auth/signup", {
            pageTitle: "Register",
            isLoggedIn: false,
            errors: ["Image must be less than 2MB"],
            oldInput: {},
            user: {}
        });
    }
    console.error(err.stack);
    res.status(500).render("404", { pageTitle: "Server Error" });
});

mongoose.connect(DB_PATH).then(() => {
    console.log("Connected to mongoose");
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
    setInterval(async () => {
        try {
            await Booking.updateMany(
                { status: "upcoming", checkOut: { $lt: new Date() }, paymentStatus: "paid" },
                { $set: { status: "completed" } }
            );
        } catch (err) {
            console.error("Cron error:", err);
        }
    }, 60 * 60 * 1000);
}).catch((err) => { console.log(err); });



import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from 'url';
import mongoose from "mongoose";
import session from "express-session";
import connectMongoDBSession from 'connect-mongodb-session';
import multer from "multer";
import helmet from "helmet";
import csrf from "csurf";

import authRouter from "./routes/authRouter.js";
import storeRouter from "./routes/storeRouter.js";
import { hostRouter} from "./routes/hostRouter.js";
import { errorController } from "./controllers/error.js";
import { contactController } from "./controllers/contact.js";
import { aboutController } from "./controllers/about.js";
import { hostsController } from "./controllers/hosts.js";
import passport from "./config/passport.js";
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
const csrfProtection = csrf();

app.set('view engine','ejs');
app.set('views',path.join(__dirname, "views")); 

const randomString=(length)=>{
    const characters ='abcdefghijklmnopqrstuvwxyz';
    let result ='';
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
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
app.use(multer(multerOptions).single('photo'));
app.use('/uploads',express.static(path.join(__dirname, 'uploads')));
app.use('/host/uploads',express.static(path.join(__dirname, 'uploads')));
app.use('/homeList/uploads',express.static(path.join(__dirname, 'uploads')));
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
        sameSite:'strict'
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
        console.log("SESSION:", req.session);
        if(!req.session.userId){
            console.log("NO USER ID IN SESSION");
            return next();
        }
        console.log("USER ID:", req.session.userId);
        const user = await User.findById(req.session.userId);
        console.log("FOUND USER:", user);
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

app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
        // Set session manually (consistent with your existing auth)
        req.session.userId = req.user._id;
        req.session.isLoggedIn = true;

        // New Google user who hasn't picked a role yet
        if (req.user.needsRole) {
            return res.redirect("/complete-profile");
        }
        res.redirect("/");
    }
);
app.use(authRouter);
app.use("/",storeRouter);
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
    next(err);
});

mongoose.connect(DB_PATH).then(()=>{
    console.log("Connected to mongoose");
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });  
}).catch((err)=>{
    console.log(err);
})



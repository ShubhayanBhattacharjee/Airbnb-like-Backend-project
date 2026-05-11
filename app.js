import express from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from 'url';
import mongoose from "mongoose";
import session from "express-session";
import connectMongoDBSession from 'connect-mongodb-session';
import multer from "multer";

import authRouter from "./routes/authRouter.js";
import storeRouter from "./routes/storeRouter.js";
import { hostRouter} from "./routes/hostRouter.js";
import { errorController } from "./controllers/error.js";
import { contactController } from "./controllers/contact.js";
import { aboutController } from "./controllers/about.js";
import { hostsController } from "./controllers/hosts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app=express();
const port=3000;
const DB_PATH="mongodb+srv://root:root@airbnb-clone-cluster.cprqz5i.mongodb.net/?appName=Airbnb-clone-cluster"

const MongoDBStore = connectMongoDBSession(session);
const store = new MongoDBStore({
  uri: DB_PATH,
  collection: 'sessions',
  connectionOptions: {
    tls: true,
    tlsAllowInvalidCertificates: true
  }
});


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

const fileFilter=(req,file,cb)=>{
    if(file.mimetype==='image/png' || file.mimetype==='image/jpg' || file.mimetype==='image/jpeg'){
        cb(null,true);
    }
    else{
        cb(null,false);
    }   
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
      cb(null, randomString(10) + '-' + file.originalname )
    }
});

const multerOptions={
    storage, fileFilter
};
 
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.urlencoded({extended:true}));
app.use(multer(multerOptions).single('photo'));
app.use('/uploads',express.static(path.join(__dirname, 'uploads')));
app.use('/host/uploads',express.static(path.join(__dirname, 'uploads')));
app.use('/homeList/uploads',express.static(path.join(__dirname, 'uploads')));
app.use(
  session({
    secret: 'Shubhayan Bhattacharjee', // secret key
    resave: false,                     // don't save session if unmodified
    saveUninitialized: true,           // save uninitialized sessions
    // cookie: { secure: false },         // set true if using HTTPS
    store:store
    })
);
app.use((req, res, next) => {
    req.isLoggedIn = req.session.isLoggedIn;
    next();
});
app.use(authRouter);
app.use("/",storeRouter);
app.use("/host",(req,res,next)=>{
    if(req.session.isLoggedIn){
        next();
    }else{       
        res.redirect("/login");
    }
});
app.use("/host",hostRouter);
app.use("/contact",contactController.contact);
app.use("/about",aboutController.about);
app.use("/hosts",hostsController.hosts);
app.use(errorController.pageNotFound);

mongoose.connect(DB_PATH).then(()=>{
    console.log("Connected to mongoose");
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });  
}).catch((err)=>{
    console.log(err);
})



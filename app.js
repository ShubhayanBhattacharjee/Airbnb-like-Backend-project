import express from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from 'url';
import storeRouter from "./routes/storeRouter.js";
import { hostRouter} from "./routes/hostRouter.js";
import authRouter from "./routes/authRouter.js";
import { errorController } from "./controllers/error.js";
import { mongoose } from "mongoose";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app=express();

app.set('view engine','ejs');
app.set('views',path.join(__dirname, "views")); 

app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public"))); 

app.use((req,res,next)=>{
    req.isLoggedIn=req.get('Cookie')?.split('=')[1]==='true' || false;   //considering the site has only one cookie 
    next();
})
app.use(authRouter);
app.use("/",storeRouter);
app.use("/host",(req,res,next)=>{
    if(req.isLoggedIn){
        next();
    }else{       
        res.redirect("/login");
    }
});
app.use("/host",hostRouter);
app.use(errorController.pageNotFound);

const port=3000;
const DB_PATH="mongodb+srv://root:root@airbnb-clone-cluster.cprqz5i.mongodb.net/airbnb?retryWrites=true&w=majority&appName=Airbnb-clone-cluster";

mongoose.connect(DB_PATH).then(()=>{
    console.log("Connected to mongoose");
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });  
}).catch((err)=>{
    console.log(err);
})



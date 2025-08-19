//external modules
import express from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from 'url';

//local modules
import userRouter from "./routes/userRouter.js";
import { hostRouter} from "./routes/hostRouter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

//creating the server(http.createServer()...equivalent nodejs server)
const app=express();

//setting ejs 
app.set('view engine','ejs');
app.set('views',path.join(__dirname, "views")); 

//middlewares
app.use(express.urlencoded({extended:true}));

// serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));

// request loggers
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

//routers
app.use(userRouter);
app.use("/host",hostRouter);

// 404 handler
app.use((req, res, next) => {
    // res.status(404).sendFile(path.join(__dirname, 'views','404.html'));
    res.status(404).render("404");
});

//listening to the requests by creating the port 
const port=3000;
app.listen(port,()=>{
    console.log(`Server running on : http://localhost:${port}`);
});

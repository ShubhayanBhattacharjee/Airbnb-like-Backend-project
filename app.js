import express from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from 'url';
import storeRouter from "./routes/storeRouter.js";
import { hostRouter} from "./routes/hostRouter.js";
import { errorController } from "./controllers/error.js";
import mongoConnect from "./utils/databaseUtil.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app=express();
app.set('view engine','ejs');
app.set('views',path.join(__dirname, "views")); 
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public"))); 
app.use("/",storeRouter);
app.use("/host",hostRouter);

app.use(errorController.pageNotFound);

const port=3000;
mongoConnect(()=>{ 
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });   
});



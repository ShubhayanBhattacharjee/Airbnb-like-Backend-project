import mongoose from "mongoose";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import path from "path";
import Home from '../models/home.js';
 
const getaddHome=(req, res, next) => {
    res.render("host/editHome",{ 
        pageTitle: 'Add Home',
        editing:false,
        // isLoggedIn:req.isLoggedIn,
        // user:req.user
    });
}

const getEditHome = async (req,res,next)=>{
    try{
        const homeId = req.params.homeId;
        if(!mongoose.Types.ObjectId.isValid(homeId)){
            return res.status(404).send("Invalid Home ID");
        }
        const home = await Home.findOne({
            _id: homeId,
            owner: req.user._id
        });
        if(!home){
            return res.status(403).send("Forbidden");
        }
        res.render("host/editHome",{
            home,
            pageTitle:"Edit Home",
            editing:true,
            // isLoggedIn:req.isLoggedIn,
            // user:req.user
        });
    }catch(err){
        console.log(err);
    }
}

const hostHomeList = (req, res, next) => {
    Home.find({ owner: req.user._id })
        .then((rows) => {
            res.render("host/hostHomeList", {
                pageTitle: 'Host Home List',
                registeredHomes: rows,
                // isLoggedIn:req.isLoggedIn,
                // user:req.user
            });
        })
        .catch(err => console.log(err));
};

const postaddHome = async (req, res, next) => {
    let { houseName, price, location, no_of_bedRooms,  description } = req.body;
    console.log(houseName,price,location,no_of_bedRooms,description);
    console.log(req.file);
    price = parseInt(price, 10);
    if (isNaN(price) || price <= 0) {
        return res.status(400).send("Price must be a valid positive number!");
    }

    if (!req.file) {
        return res.status(422).send("No image provided by the host")
    }
    const type = await fileTypeFromBuffer(req.file.buffer);
    if(
        !type ||
        !["image/jpeg","image/png"].includes(type.mime)
    ){
        return res.status(422).send("Only JPG and PNG allowed");
    }
    const filename =
        Date.now() +
        "-" +
        Math.random().toString(36).substring(2) +
        ".jpg";
    await sharp(req.file.buffer)
        .resize(800, 600)
        .jpeg({ quality: 80 })
        .toFile(path.join("uploads", filename));
    const photo = "/uploads/" + filename;
    const home = new Home({houseName, price, location, no_of_bedRooms, photo, description,owner:req.user._id});
    home.save()
       .then(() => res.redirect('/host/hostHomeList'))
        .catch(err => {
        console.error("Error saving home:", err);
        res.status(500).send(err.sqlMessage || err.message);
    });
};

const postEditHome = async (req, res, next) => {
    try {
        const homeId = req.params.homeId;
        if(!mongoose.Types.ObjectId.isValid(homeId)){
            return res.status(404).send("Invalid Home ID");
        }
        let {
            houseName,
            price,
            location,
            no_of_bedRooms,
            description
        } = req.body;
        price = parseInt(price, 10);
        if (isNaN(price) || price <= 0) {
            return res.status(400).send("Price must be a valid positive number!");
        }
        const home = await Home.findOne({
            _id: homeId,
            owner: req.user._id
        });
        if (!home) {
            return res.status(403).send("Forbidden");
        }
        home.houseName = houseName;
        home.price = price;
        home.location = location;
        home.no_of_bedRooms = no_of_bedRooms;
        home.description = description;
        if(req.file){
            const type = await fileTypeFromBuffer(req.file.buffer);
            if(
                !type ||
                !["image/jpeg","image/png"].includes(type.mime)
            ){
                return res.status(422).send("Only JPG and PNG allowed");
            }
            const filename =
                Date.now() +
                "-" +
                Math.random().toString(36).substring(2) +
                ".jpg";
            await sharp(req.file.buffer)
                .resize(800,600)
                .jpeg({quality:80})
                .toFile(path.join("uploads", filename));
            home.photo = "/uploads/" + filename;
        }
        await home.save();
        res.redirect("/host/hostHomeList");
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

const postDeleteHome = async (req,res,next)=>{
    try{
        const homeId = req.params.homeId;
        if(!mongoose.Types.ObjectId.isValid(homeId)){
            return res.status(404).send("Invalid Home ID");
        }   
        const result = await Home.findOneAndDelete({
            _id: homeId,
            owner: req.user._id
        });
        if(!result){
            return res.status(403).send("Forbidden");
        }
        res.redirect("/host/hostHomeList");
    }catch(err){
        console.log(err);
    }
}

export const hostController={postDeleteHome,getaddHome,postaddHome,hostHomeList,getEditHome,postEditHome};
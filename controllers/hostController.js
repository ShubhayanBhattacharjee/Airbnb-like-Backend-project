import { log } from 'console';
import Home from '../models/home.js';
 
const getaddHome=(req, res, next) => {
    res.render("host/editHome",{ pageTitle: 'Add Home',editing:false});
}

const getEditHome = (req, res, next) => {
    const homeId = req.params.homeId;
    const editing = req.query.editing === 'true';
    Home.findById(homeId)
        .then(home => {
            if (!home ) {
                console.log("Home not found for editing.\n");
                return res.redirect("/host/hostHomeList");
            }
            res.render("host/editHome", {
                home,
                pageTitle: 'Edit Home',
                editing: true,
            });
        })
        .catch(err => console.log(err));
};

const postaddHome = (req, res, next) => {
    let { houseName, price, location, no_of_bedRooms, photoUrl, description } = req.body;
    price = parseInt(price, 10);
    if (isNaN(price) || price <= 0) {
        return res.status(400).send("Price must be a valid positive number!");
    }
    const home = new Home({houseName, price, location, no_of_bedRooms, photoUrl, description});
    home.save()
       .then(() => res.redirect('/host/hostHomeList'))
        .catch(err => {
        console.error("Error saving home:", err);
        res.status(500).send(err.sqlMessage || err.message);
    });
};

const hostHomeList = (req, res, next) => {
    Home.find()
        .then((rows) => {
            res.render("host/hostHomeList", {
                pageTitle: 'Host Home List',
                registeredHomes: rows
            });
        })
        .catch(err => console.log(err));
};

const postEditHome = (req, res, next) => {
    const homeId = req.params.homeId;
    let { houseName, price, location, no_of_bedRooms, photoUrl, description } = req.body;

    price = parseInt(price, 10);
    if (isNaN(price) || price <= 0) {
        return res.status(400).send("Price must be a valid positive number!");
    }
    Home.findById(homeId).then((home)=>{
        home.houseName=houseName;
        home.price=price;
        home.location=location;
        home.no_of_bedRooms=no_of_bedRooms;
        home.photoUrl=photoUrl;
        home.description=description;
        home.save().then((res)=>{
            console.log("Home added.\n",res);
        }).catch((err)=>{
            console.log("Error occurredin editing home.\n",err);
        })
        res.redirect('/host/hostHomeList');
    }).then((err)=>{
        console.log("Error occurred in finding the home.\n",err);
    });
};

 

const postDeleteHome = (req, res, next) => {
    const homeId = req.params.homeId;
    Home.findByIdAndDelete(homeId)
        .then(() => res.redirect('/host/hostHomeList'))
        .catch(err => console.log(err));
};

export const hostController={postDeleteHome,getaddHome,postaddHome,hostHomeList,getEditHome,postEditHome};
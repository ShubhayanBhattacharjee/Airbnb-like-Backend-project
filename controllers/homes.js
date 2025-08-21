import Home from '../models/home.js';
 
const getaddHome=(req, res, next) => {
    res.render("addHome",{ pageTitle: 'Add Home' });
}

const postaddHome=(req, res, next) => {
    console.log("Home resgistered successful for : ",req.body); 
    const {houseName,price,location,no_of_bedRooms,photoUrl} =req.body;
    const home = new Home(houseName,price,location,no_of_bedRooms,photoUrl);
    home.save();    
    res.render('homeAdded', { 
        pageTitle: 'Home Added', 
        houseName: houseName ,
    });
}

const getHome=(req, res, next) => {
    const registeredHomes=Home.fetchAll();
    res.render("index",{registeredHomes:registeredHomes,pageTitle:"Home page"});
};

export const homeController={getaddHome,postaddHome,getHome};
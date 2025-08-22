import Home from '../models/home.js';
 
const getaddHome=(req, res, next) => {
    res.render("host/addHome",{ pageTitle: 'Add Home' });
}

const postaddHome=(req, res, next) => {
    const {houseName,price,location,no_of_bedRooms,photoUrl} =req.body;
    const home = new Home(houseName,price,location,no_of_bedRooms,photoUrl);
    home.save();    
    res.render('host/homeAdded', { 
        pageTitle: 'Home Added', 
        houseName: houseName ,
    });
}

const hostHomeList=(req, res, next) => {
    const homes=Home.fetchAll(homes=>{
        res.render("host/hostHomeList",{ 
            pageTitle: 'Host Home List', 
            registeredHomes: homes 
        });
    });
}

export const hostController={getaddHome,postaddHome,hostHomeList};
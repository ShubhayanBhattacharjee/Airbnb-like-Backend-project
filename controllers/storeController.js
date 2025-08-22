import Home from '../models/home.js';

const getHome=(req, res, next) => {
    const registeredHomes=Home.fetchAll(registeredHomes=>{
        res.render("store/index",{ 
            pageTitle: 'Home', 
            registeredHomes: registeredHomes 
        });
    });
}

const getBookings=(req, res, next) => {
    res.render("store/bookings",{ pageTitle: 'Bookings' });
}

const getFavourites=(req, res, next) => {
    const registeredHomes=Home.fetchAll(registeredHomes=>{
        res.render("store/favourites",{ 
            pageTitle: 'Favourites', 
            registeredHomes: registeredHomes 
        });
    });
}

const gethomeList=(req, res, next) => {
    const registeredHomes=Home.fetchAll(registeredHomes=>{
        res.render("store/homeList",{ 
            pageTitle: 'Home Lists', 
            registeredHomes: registeredHomes 
        });
    });
}

export const storeController={getHome,getBookings, getFavourites, gethomeList};
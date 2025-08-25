import Favourites from '../models/favourites.js';
import Home from '../models/home.js';

const getHome = (req, res, next) => {
    Home.fetchAll().then(([registeredHomes]) => {
        res.render("store/index", {
            pageTitle: 'Home',
            registeredHomes: registeredHomes
        });
    });
}

const getBookings = (req, res, next) => {
    res.render("store/bookings", { pageTitle: 'Bookings' });
}

const getFavourites = (req, res, next) => {
    Favourites.getFav(favIds => {
        Home.fetchAll().then(([homes]) => {
            const favHomes = homes.filter(h => favIds.includes(h.id));
            res.render("store/favourites", {
                pageTitle: 'Favourites',
                registeredHomes: favHomes
            });
        });
    });
};


const postAddFav = (req, res, next) => {
    console.log("At postAddFav, homeId: " + req.body.homeId);
    Favourites.addToFav(req.body.homeId, err => {
        if (err) {
            console.log("Error adding to favourites: ", err);
        } else {
            console.log("Home added to favourites successfully");
        }
    });
    res.redirect('/favourites');
}

const postRemoveFav = (req, res, next) => {
    const homeId = req.params.homeId;
    console.log("Removing from Favourites:", homeId);
    Favourites.removeFromFav(homeId, (err) => {
        if (err) {
            console.error("Error removing from favourites:", err);
        } else {
            console.log(`Home ID ${homeId} removed from favourites.`);
        }
        res.redirect("/favourites");
    });
};

const gethomeList = (req, res, next) => {
    Home.fetchAll()
        .then(([registeredHomes]) => {
            res.render("index", {
                pageTitle: "Home Lists",
                registeredHomes: registeredHomes
            });
        })
};


const gethomeDetails = (req, res, next) => {
    const homeId = req.params.homeId;
    console.log("At home details page id is: " + homeId);
    Home.findById(homeId, home => {
        if (!home) {
            console.log("Home not found, redirecting to home list");
            res.redirect('/homeList');
        } else {
            console.log("Home details found ", home);
            res.render("store/homeDetails", {
                pageTitle: 'Home Details',
                home: home
            });
        }
    });
}

export const storeController = { getHome, getBookings, getFavourites, postAddFav, postRemoveFav, gethomeList, gethomeDetails };
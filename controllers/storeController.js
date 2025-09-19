import Favourites from '../models/favourites.js';
import Home from '../models/home.js';

const getHome = (req, res, next) => {
    Home.fetchAll().then((registeredHomes) => {
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
    Favourites.getFav()
        .then(favDocs => {
            const favIds = favDocs
                .map(fav => fav.houseId)
                .filter(id => id)          // remove nulls
                .map(id => id.toString());

            Home.fetchAll().then(homes => {
                const favHomes = homes.filter(home =>
                    favIds.includes(home._id.toString())
                );
                res.render("store/favourites", {
                    pageTitle: 'Favourites',
                    registeredHomes: favHomes
                });
            });
        })
        .catch(err => console.error(err));
};


const postAddFav = (req, res, next) => {
    const homeId=req.body.homeId;
    if (!homeId) return res.status(400).send("Invalid home ID");
    const fav=new Favourites(homeId);
    fav.save()
    .then(res=>{
        console.log(res);
    }).catch(err=>{
        console.log(err);
    }).finally(()=>{
        res.redirect('/favourites');
    });
}

const postRemoveFav = (req, res, next) => {
    const homeId = req.params.homeId;
    Favourites.removeFromFav(homeId)
        .then(result => console.log(`Home ID ${homeId} removed from favourites.`))
        .catch(err => console.error(err))
        .finally(() => res.redirect("/favourites"));
};

const gethomeList = (req, res, next) => {
    Home.fetchAll()
        .then((registeredHomes) => {
            res.render("store/homeList", {
                pageTitle: "Home Lists",
                registeredHomes: registeredHomes
            });
        })
};


const gethomeDetails = (req, res, next) => {
    const homeId = req.params.homeId;
    Home.findById(homeId).then(home => {
        if (!home) {
            console.log("Home not found, redirecting to home list");
            res.redirect('/homeList');
        } else {
            res.render("store/homeDetails", {
                pageTitle: 'Home Details',
                home: home
            });
        }
    });
}

export const storeController = { getHome, getBookings, getFavourites, postAddFav, postRemoveFav, gethomeList, gethomeDetails };
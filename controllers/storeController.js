import home from '../models/home.js';
import Home from '../models/home.js';
import User from '../models/user.js';

const getHome = (req, res, next) => {
    console.log("Session Value : ",req.session.isLoggedIn);
    Home.find().then((registeredHomes) => {
        res.render("store/index", {
            pageTitle: 'Home',
            registeredHomes: registeredHomes,
            isLoggedIn:req.isLoggedIn,
            user:req.session.user
        });
    });
}

const getBookings = (req, res, next) => {
    res.render("store/bookings", { 
        pageTitle: 'Bookings',
        isLoggedIn:req.isLoggedIn,
        user:req.session.user
    });
}

export const getFavourites = async (req, res, next) => {
    const userId= req.session.user._id;
    const user= await User.findById(userId).populate('favourites');
    res.render("store/favourites", {
        registeredHomes: user.favourites,
        pageTitle: "Favourites",
        isLoggedIn:req.isLoggedIn,
        user:req.session.user
    });
};

const gethomeList = (req, res, next) => {
    Home.find()
        .then((registeredHomes) => {
            res.render("store/homeList", {
                pageTitle: "Home Lists",
                registeredHomes: registeredHomes,
                isLoggedIn:req.isLoggedIn,
                user:req.session.user
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
                home: home,
                isLoggedIn:req.isLoggedIn,
                user:req.session.user
            });
        }
    });
}

const postAddFav = async (req, res, next) => {
    const homeId=req.body.homeId;
    const userId= req.session.user._id;
    const user= await User.findById(userId);
    if(!user.favourites.includes(homeId)){
        user.favourites.push(homeId);
        await user.save();
    }
    res.redirect('/favourites');
}

const postRemoveFav = async (req, res, next) => {
    const homeId = req.params.homeId;
    const userId= req.session.user._id;
    const user= await User.findById(userId);
    if( user.favourites.includes(homeId)){
        user.favourites=user.favourites.filter(fav=>fav!=homeId);
        await user.save();
    }
    res.redirect("/favourites");
};

export const storeController = { getHome, getBookings, getFavourites, postAddFav, postRemoveFav, gethomeList, gethomeDetails };
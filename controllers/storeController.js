import home from '../models/home.js';
import Home from '../models/home.js';
import User from '../models/user.js';

const getHome = (req, res, next) => {
    console.log("Session Value : ",req.session.isLoggedIn);
    Home.find().then((registeredHomes) => {
        res.render("store/index", {
            pageTitle: 'Home',
            registeredHomes: registeredHomes,
        });
    });
}

export const getFavourites = async (req, res, next) => {
    const userId= req.user._id;
    const user= await User.findById(userId).populate('favourites');
    res.render("store/favourites", {
        registeredHomes: user.favourites,
        pageTitle: "Favourites",
    });
};

const gethomeList = (req, res, next) => {
    Home.find()
        .then((registeredHomes) => {
            let favouriteIds = [];
            if(req.user){
                favouriteIds = req.user.favourites.map(
                    id => id.toString()
                );
            }
            res.render("store/homeList", {
                pageTitle: "Home Lists",
                registeredHomes,
                favouriteIds
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
            let isFavourite = false;
            if(req.user){
                isFavourite =
                    req.user.favourites.some(
                        fav => fav.toString() === home._id.toString()
                    );
            }
            res.render("store/homeDetails",{
                pageTitle:"Home Details",
                home,
                isFavourite
            });
        }
    });
}

const postAddFav = async (req,res,next)=>{
    if(!req.user){
        return res.redirect("/login");
    }
    const homeId = req.body.homeId;
    const user = await User.findById(req.user._id);
    if(!user.favourites.includes(homeId)){
        user.favourites.push(homeId);
        await user.save();
    }
    res.redirect("/favourites");
}

const postRemoveFav = async (req, res, next) => {
    const homeId = req.params.homeId;
    const userId= req.user._id;
    const user= await User.findById(userId);
    if( user.favourites.includes(homeId)){
        user.favourites = user.favourites.filter(
            fav => fav.toString() !== homeId
        );
        await user.save();
    } 
    res.redirect("/favourites");
};

export const storeController = { getHome,getFavourites, postAddFav, postRemoveFav, gethomeList, gethomeDetails };
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

const gethomeList = async (req, res, next) => {
    try {
        const registeredHomes = await Home.find();
        let favouriteIds = [];
        if (req.user) {
            favouriteIds = req.user.favourites.map(id => id.toString());
        }
        res.render("store/homeList", { pageTitle: "Home Lists", registeredHomes, favouriteIds });
    } catch (err) {
        next(err);
    }
};


const gethomeDetails = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.homeId).populate("owner", "fname lname profileImage bio location stays");
        if (!home) return res.redirect('/homeList');
        let isFavourite = false;
        if (req.user) {
            isFavourite = req.user.favourites.some(
                fav => fav.toString() === home._id.toString()
            );
        }
        const hostOtherHomes = await Home.find({
            owner: home.owner._id,
            _id: { $ne: home._id }  // exclude current home
        }).limit(3);
        res.render("store/homeDetails", {
            pageTitle: "Home Details",
            home,
            isFavourite,
            hostOtherHomes
        });
    } catch (err) {
        next(err);
    }
};

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
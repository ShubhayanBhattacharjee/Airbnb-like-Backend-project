import Home from '../models/home.js';
import User from '../models/user.js';

const getHome = async (req, res, next) => {
    try {
        const registeredHomes = await Home.find();
        res.render("store/index", { pageTitle: 'Home', registeredHomes });
    } catch (err) {
        next(err);
    }
};

export const getFavourites = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).populate('favourites');
        res.render("store/favourites", {
            registeredHomes: user.favourites,
            pageTitle: "Favourites"
        });
    } catch (err) {
        next(err);
    }
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

const postAddFav = async (req, res, next) => {
    try {
        if (!req.user) return res.redirect("/login");
        const homeId = req.body.homeId;
        const redirectTo = req.body.redirectTo || "/homeList";
        const user = await User.findById(req.user._id);
        const alreadySaved = user.favourites.some(fav => fav.toString() === homeId);
        if (alreadySaved) {
            user.favourites = user.favourites.filter(fav => fav.toString() !== homeId);
        } else {
            user.favourites.push(homeId);
        }
        await user.save();
        res.redirect(redirectTo);
    } catch (err) {
        next(err);
    }
};


const postRemoveFav = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        user.favourites = user.favourites.filter(
            fav => fav.toString() !== req.params.homeId
        );
        await user.save();
        res.redirect("/favourites");
    } catch (err) {
        next(err);
    }
};

export const storeController = { getHome,getFavourites, postAddFav, postRemoveFav, gethomeList, gethomeDetails };
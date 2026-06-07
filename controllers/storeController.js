import Home from '../models/home.js';
import User from '../models/user.js';
import { getUnavailableHomeIds } from '../utils/availability.js';

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
        const { search, location, minPrice, maxPrice, bedrooms, sort } = req.query;
        const filter = {};
        if (search && search.trim()) {
            filter.$or = [
                { houseName: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } },
                { location: { $regex: search.trim(), $options: 'i' } }
            ];
        }
        if (location && location.trim()) {
            filter.location = { $regex: location.trim(), $options: 'i' };
        }
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }
        if (bedrooms && bedrooms !== 'any') {
            if (bedrooms === '5+') {
                filter.no_of_bedRooms = { $gte: 5 };
            } else {
                filter.no_of_bedRooms = Number(bedrooms);
            }
        }
        if (req.query.checkIn && req.query.checkOut) {
            const inDate  = new Date(req.query.checkIn);
            const outDate = new Date(req.query.checkOut);

            if (!isNaN(inDate) && !isNaN(outDate) && outDate > inDate) {
                const unavailableIds = await getUnavailableHomeIds(inDate, outDate);
                filter._id = { $nin: unavailableIds };
            }
        }
        let sortOption = {};
        if (sort === 'price_asc')  sortOption = { price: 1 };
        else if (sort === 'price_desc') sortOption = { price: -1 };
        else if (sort === 'newest') sortOption = { _id: -1 };
        else sortOption = { _id: -1 }; // default: newest
        const registeredHomes = await Home.find(filter).sort(sortOption);
        const allHomes = await Home.find({}, 'location');
        const locations = [...new Set(allHomes.map(h => h.location).filter(Boolean))];
        const priceStats = await Home.aggregate([
            { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }
        ]);
        const minPriceBound = priceStats[0]?.min || 0;
        const maxPriceBound = priceStats[0]?.max || 10000;
        let favouriteIds = [];
        if (req.user) {
            favouriteIds = req.user.favourites.map(id => id.toString());
        }
        res.render("store/homeList", {
            pageTitle: "Home Lists",
            registeredHomes,
            favouriteIds,
            locations,
            minPriceBound,
            maxPriceBound,
            filters: {
                search:   search   || '',
                location: location || '',
                minPrice: minPrice || '',
                maxPrice: maxPrice || '',
                bedrooms: bedrooms || 'any',
                sort:     sort     || 'newest',
                checkIn:  req.query.checkIn  || '',   
                checkOut: req.query.checkOut || '' 
            }
        });
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
            _id: { $ne: home._id }  
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
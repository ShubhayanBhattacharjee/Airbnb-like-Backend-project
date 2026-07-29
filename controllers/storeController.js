import Home, { HOME_TYPE_OPTIONS } from '../models/home.js';
import User from '../models/user.js';
import Booking from '../models/booking.js';
import Review from '../models/review.js';
import { getUnavailableHomeIds } from '../utils/availability.js';
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js';
import { geocodeAddress } from '../utils/geocode.js';
import { notify } from '../utils/notify.js';

const getHome = async (req, res, next) => {
    try {
        const registeredHomes = await Home.find();
        const currentUserId = req.user ? req.user._id.toString() : null;
        res.render("store/index", { pageTitle: 'Home', registeredHomes, currentUserId });
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
        const { search, location, minPrice, maxPrice, bedrooms, sort, homeType } = req.query;
        const filter = {};
        filter.isHidden = { $ne: true };

        if (search && search.trim()) {
            const words = search.trim().split(/\s+/).filter(Boolean);
            filter.$and = words.map(word => ({
                $or: [
                    { houseName:   { $regex: word, $options: 'i' } },
                    { description: { $regex: word, $options: 'i' } },
                    { location:    { $regex: word, $options: 'i' } }
                ]
            }));
        }

        if (location && location.trim()) {
            const [city, state] = location.split(',').map(s => s.trim());
            if (city) filter.city = { $regex: `^${city}$`, $options: 'i' };
            if (state) filter.state = { $regex: `^${state}$`, $options: 'i' };
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
        if (homeType && homeType !== 'any' && HOME_TYPE_OPTIONS.includes(homeType)) {
            filter.homeType = homeType;
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
        else sortOption = { _id: -1 };
        const HOMES_PER_PAGE = 20;
        const page     = Math.max(1, parseInt(req.query.page) || 1);
        const total    = await Home.countDocuments(filter);
        const totalPages = Math.ceil(total / HOMES_PER_PAGE);
        const registeredHomes = await Home.find(filter)
            .sort(sortOption)
            .skip((page - 1) * HOMES_PER_PAGE)
            .limit(HOMES_PER_PAGE);

        const allHomes = await Home.find({}, 'city state');
        const locationSet = new Set();
        allHomes.forEach(h => {
            if (h.city && h.state) {
                locationSet.add(`${h.city.trim()}, ${h.state.trim()}`);
            }
        });
        const locations = Array.from(locationSet).sort();

        const boardHomes = await Home.find({ isHidden: { $ne: true } })
            .select('houseName city price no_of_bedRooms')
            .sort({ _id: -1 })
            .limit(5);
        const priceStats = await Home.aggregate([
            { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }
        ]);
        const minPriceBound = priceStats[0]?.min || 0;
        const maxPriceBound = priceStats[0]?.max || 10000;
        let favouriteIds = [];
        if (req.user) {
            favouriteIds = req.user.favourites.map(id => id.toString());
        }
        const currentUserId = req.user ? req.user._id.toString() : null;
        res.render("store/homeList", {
            pageTitle: "Home Lists",
            registeredHomes,
            favouriteIds,
            currentUserId,
            locations,
            boardHomes,
            minPriceBound,
            maxPriceBound,
            page,
            totalPages,
            total,
            homeTypes: HOME_TYPE_OPTIONS,
            filters: {
                search:   search   || '',
                location: location || '',
                minPrice: minPrice || '',
                maxPrice: maxPrice || '',
                bedrooms: bedrooms || 'any',
                sort:     sort     || 'newest',
                checkIn:  req.query.checkIn  || '',
                checkOut: req.query.checkOut || '',
                homeType: homeType || 'any'
            }
        });
    } catch (err) {
        next(err);
    }
};
const gethomeDetails = async (req, res, next) => {
    try {
        const home = await Home.findById(req.params.homeId)
            .populate("owner", "fname lname profileImage bio location stays");
        if (!home) return res.redirect('/homeList');

        if (!home.lat || !home.lng) {
            const coords = await geocodeAddress({
                addressLine1: home.addressLine1,
                addressLine2: home.addressLine2,
                city: home.city,
                state: home.state,
                pincode: home.pincode,
                country: home.country
            });
            if (coords) {
                home.lat = coords.lat;
                home.lng = coords.lng;
                await home.save();
            }
        }

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

        const reviews = await Review.find({ home: home._id })
            .populate("guest", "fname lname profileImage")
            .sort({ createdAt: -1 });

        res.render("store/homeDetails", {
            pageTitle: "Home Details",
            home,
            isFavourite,
            hostOtherHomes,
            reviews
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
        const targetHome = await Home.findById(homeId);
        if (targetHome && targetHome.owner && targetHome.owner.toString() === req.user._id.toString()) {
            return res.redirect(redirectTo);
        }
        const user = await User.findById(req.user._id);
        const alreadySaved = user.favourites.some(fav => fav.toString() === homeId);
        if (alreadySaved) {
            user.favourites = user.favourites.filter(fav => fav.toString() !== homeId);
        } else {
            user.favourites.push(homeId);
        }
        await user.save();
        try {
            const home = targetHome;
            if (home) {
                await notify({
                    userId: user._id,
                    type: alreadySaved ? "favourite_removed" : "favourite_added",
                    title: alreadySaved ? "Removed from favourites" : "Added to favourites",
                    message: alreadySaved
                        ? `${home.houseName} was removed from your favourites.`
                        : `${home.houseName} was added to your favourites.`,
                    link: `/homeList/${home._id}`,
                    icon: "heart",
                    meta: { homeId: home._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Favourite notification failed:", notifyErr.message);
        }
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
        try {
            const home = await Home.findById(req.params.homeId);
            if (home) {
                await notify({
                    userId: user._id,
                    type: "favourite_removed",
                    title: "Removed from favourites",
                    message: `${home.houseName} was removed from your favourites.`,
                    link: `/favourites`,
                    icon: "heart",
                    meta: { homeId: home._id.toString() }
                });
            }
        } catch (notifyErr) {
            console.error("Favourite notification failed:", notifyErr.message);
        }
        res.redirect("/favourites");
    } catch (err) {
        next(err);
    }
};


export const storeController = { getHome,getFavourites, postAddFav, postRemoveFav, gethomeList, gethomeDetails};
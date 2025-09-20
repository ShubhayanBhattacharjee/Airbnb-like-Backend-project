import Favourites from '../models/favourites.js';
import Home from '../models/home.js';

const getHome = (req, res, next) => {
    Home.find().then((registeredHomes) => {
        res.render("store/index", {
            pageTitle: 'Home',
            registeredHomes: registeredHomes
        });
    });
}

const getBookings = (req, res, next) => {
    res.render("store/bookings", { pageTitle: 'Bookings' });
}

export const getFavourites = (req, res, next) => {
  Favourites.find()
    .populate("homeId")
    .then(favDocs => {
      const favHomes = favDocs
        .map(fav => fav.homeId)
        .filter(home => home); // remove nulls in case a Home was deleted

      res.render("store/favourites", {
        registeredHomes: favHomes,
        pageTitle: "Favourites"
      });
    })
    .catch(err => {
      console.error("Error fetching favourites:", err);
      next(err);
    });
};



const postAddFav = (req, res, next) => {
    const homeId=req.body.homeId;
    if (!homeId) return res.status(400).send("Invalid home ID");
    Favourites.findOne({homeId:homeId}).then((fav)=>{
        if(fav){    
            console.log("Already marked as favourite.\n");
        }else{
            fav=new Favourites({homeId:homeId});
            fav.save().then((savedFav)=>{
                console.log("fav added\n",savedFav);
            });
        }
        res.redirect('/favourites');
    }).catch((err)=>{
        console.log("Error found in adding to the favoruites\n",err);
    });
}

const postRemoveFav = (req, res, next) => {
    const homeId = req.params.homeId;
    Favourites.findOneAndDelete({homeId:homeId})
        .then(result => console.log(`Home ID ${homeId} removed from favourites.`))
        .catch(err => console.error(err))
        .finally(() => res.redirect("/favourites"));
};

const gethomeList = (req, res, next) => {
    Home.find()
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
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'data', 'fav.json');

export default class Favourites {
    static addToFav(homeId, callback) {
        Favourites.getFav(favourites => {
            if (favourites.includes(homeId)) {
                console.log("Home already in favourites");
                return;
            } else{
                favourites.push(homeId);
                fs.writeFile(filePath, JSON.stringify(favourites), callback);
            }
        });
    }
    static getFav(callback) {
        fs.readFile(filePath, (err, data) => {
            if(!err){
                callback(JSON.parse(data));
            }else{
                callback([]);
            }
        });
    }
    static removeFromFav(homeId, callback) {
        Favourites.getFav((favourites) => {
            const updatedFavourites = favourites.filter(id => id !== homeId);
            fs.writeFile(filePath, JSON.stringify(updatedFavourites), callback);
        });
    }
}
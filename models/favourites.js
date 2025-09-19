import { getDB } from "../utils/databaseUtil.js";
import { ObjectId } from "mongodb";
export default class Favourites {
    constructor(houseId){
        this.houseId=houseId.toString();
    }   
    save(){
        const db=getDB();
        return db.collection('favourites').findOne({houseId:this.houseId})
        .then(existingFav=>{
            if(!existingFav){
                return db.collection("favourites").insertOne(this);
            }
            return Promise.resolve();
        })
    }
    static getFav() {
        const db=getDB();
        return db.collection("favourites").find().toArray();
    }
    static removeFromFav(homeId) {
        const db = getDB();
        return db.collection("favourites").deleteOne({ houseId: homeId.toString() });
    }
}
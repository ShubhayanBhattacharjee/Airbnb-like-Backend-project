import { ObjectId } from "mongodb"; 
import { getDB } from "../utils/databaseUtil.js";

export default class Home {
    constructor(houseName, price, location, no_of_bedRooms, photoUrl,description,_id=null) {
        this.houseName = houseName;
        this.price = price;
        this.location = location;
        this.no_of_bedRooms = no_of_bedRooms;  
        this.photoUrl = photoUrl || "/images/img.jpg";
        this.description = description || "";
        if(_id){
            this._id=_id;
        }
    }   
    save(){
        const db=getDB();
        if(this._id){    //update
            const updateFields={
                houseName:this.houseName,
                price:this.price,
                location:this.location,
                no_of_bedRooms:this.no_of_bedRooms,
                photoUrl:this.photoUrl,
                description:this.description
            }
            return db.collection("homes").updateOne(
                { _id: new ObjectId(this._id) }, 
                {$set:updateFields}
            )
        }else{  //insert
            return db.collection("homes").insertOne(this).then((result)=>{
                console.log(result);
            });
        }
        
    }
    static fetchAll() {
        const db=getDB();
        return db.collection("homes").find().toArray();
    }
    static findById(homeId) {
        const db=getDB();
        return db.collection("homes").find({_id: new ObjectId(homeId)}).next();
    }
    static DeleteById(homeId) {
        const db = getDB();
        return db.collection("homes").deleteOne({ _id: new ObjectId(homeId) });
    }
} 
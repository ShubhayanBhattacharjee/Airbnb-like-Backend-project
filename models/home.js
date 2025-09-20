import {mongoose} from "mongoose";
import Favourites from "./favourites.js";

//_id is automaticallly added by mongoose
const homeSchema=mongoose.Schema({
    houseName:{type:String,required:true},
    price:{type:Number,required:true},
    location:{type:String,required:true},
    no_of_bedRooms:{type:Number,required:true},
    photoURL:String || "/images/img.jpg",
    description:String
});
homeSchema.pre('findOneAndDelete',async function(next){
     const homeId=this.getQuery()["_id"];
     await Favourites.deleteMany({homeId:homeId});
     next();
});
 

export default mongoose.model('Home', homeSchema);
//basically by exporting this homeSchema from here means that a Home class like earlier is being created.
//now i can perform any methods like home.save and all others
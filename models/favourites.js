import {mongoose} from "mongoose";

const favSchema=new mongoose.Schema({
    homeId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Home',
        required:true,
        unique:true
    }
});

export default mongoose.model('Favoruites', favSchema);

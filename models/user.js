import {mongoose} from "mongoose";

const userSchema=mongoose.Schema({
    fname:{
        type:String,
        required:[true,'First name is required']
    },
    mname:{
        type:String,
        trim:true
    },
    lname:{
        type:String,
        required:[true,'Last name is required']
    },
    email:{
        type:String,
        required:[true,'Email is required'],
        unique:true
    },
    password:{
        type:String,
        required:[true,'Password is required']
    },
    role:{
        type:String,
        enum:['guest','host'],
        default:'guest'
    },
    favourites:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Home'
    }]

});

 

export default mongoose.model('User', userSchema);

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
    profileImage:{
        type:String,
        default:"/images/default-host.jpg"
    },
    location:{
        type:String,
        default:"Unknown"
    },
    country:{
        type:String,
        default:"Unknown"
    },
    stays:{
        type:Number,
        default:0
    },
    bio:{
        type:String,
        default:""
    },
    favourites:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Home'
    }]
});

 

export default mongoose.model('User', userSchema);

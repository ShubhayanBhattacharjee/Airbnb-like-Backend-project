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
        unique:true,
        index:true
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId;
        }
    },
    role:{
        type:String,
        enum:['guest','host','admin',],
        default:'guest'
    },
    adminRole:{
        type:String,
        enum:['support','super_admin'],
        default:'support'   
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
    phone:{
        type:String
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
    }],
    isVerified: {
    type: Boolean,
    default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetOtp: String,
    resetOtpExpires: Date,
    resetOtpAttempts: { type: Number, default: 0 },
    googleId: { type: String },
    needsRole: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    loginLockUntil: { type: Date },
    isBanned: { type: Boolean, default: false },  
    banReason: { type: String, default: '' },
    payoutDetails: {
        method: { type: String, enum: ['bank', 'upi', ''], default: '' },
        accountHolderName: { type: String, default: '' },
        accountNumber:     { type: String, default: '' },
        ifsc:              { type: String, default: '' },
        upiId:             { type: String, default: '' }
    },
    commissionOverridePercent: { type: Number, min: 0, max: 100, default: null },
});

export default mongoose.model('User', userSchema);

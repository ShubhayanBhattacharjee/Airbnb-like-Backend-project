import {mongoose} from "mongoose";

const homeSchema=mongoose.Schema({
    houseName:{type:String,required:true},
    price:{type:Number,required:true},
    location:{type:String,required:true},
    no_of_bedRooms:{type:Number,required:true},
    photo:{
        type:String,
        default:"/images/img.jpg"
    },
    description:String,
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
        index:true
    },
    blockedDates: [
        {
            from: { type: Date, required: true },
            to:   { type: Date, required: true },
            reason: { type: String, default: "" }
        }
    ],
    avgRating:   { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isFlagged:   { type: Boolean, default: false },
    flagReason:  { type: String, default: '' },
    isHidden:    { type: Boolean, default: false }
});

export default mongoose.model('Home', homeSchema);

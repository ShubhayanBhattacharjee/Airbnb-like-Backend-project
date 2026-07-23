import {mongoose} from "mongoose";

const homeSchema=mongoose.Schema({
    houseName:{type:String,required:true},
    price:{type:Number,required:true},
    location:{type:String,required:true},
    lat:{type:Number},
    lng:{type:Number},
    country: {
        type: String,
        required: true
    },
    amenities:{
        type:[String],
        default:[]
    },
    maxGuests:{type:Number,default:2},
    checkInTime:{type:String,default:"14:00"},
    checkOutTime:{type:String,default:"11:00"},
    cancellationPolicy:{
        type:String,
        enum:['flexible','moderate','strict'],
        default:'moderate'
    },
    no_of_bedRooms:{type:Number,required:true},
    photos:{
        type: [String],
        default: ["/images/img.jpg"]
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
            reason: { type: String, default: "" },
            source: { type: String, default: "manual" }
        }
    ],
    seasonalPricing: [
        {
            label: { type: String, default: "" },          
            from:  { type: Date, required: true },
            to:    { type: Date, required: true },         
            price: { type: Number, required: true }
        }
    ],
    externalCalendars: [
        {
            name: { type: String, default: "" },            
            url:  { type: String, required: true },
            lastSyncedAt: { type: Date }
        }
    ],
    icalExportToken: { type: String },
    avgRating:   { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isFlagged:   { type: Boolean, default: false },
    flagReason:  { type: String, default: '' },
    isHidden:    { type: Boolean, default: false },
    commissionOverridePercent: { type: Number, min: 0, max: 100, default: null },
});

export default mongoose.model('Home', homeSchema);
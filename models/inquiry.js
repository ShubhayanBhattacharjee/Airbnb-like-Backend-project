import { mongoose } from "mongoose";

const inquirySchema = new mongoose.Schema({
    home:  { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true, index: true },
    host:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    reply: {
        message:   { type: String, default: "" },
        repliedAt: { type: Date, default: null }
    },
    status: {
        type: String,
        enum: ["open", "answered"],
        default: "open"
    }
}, { timestamps: true });

inquirySchema.index({ host: 1, status: 1, createdAt: -1 });
inquirySchema.index({ guest: 1, createdAt: -1 });

export default mongoose.model("Inquiry", inquirySchema);
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    actorType: { type: String, enum: ["admin", "host", "guest", "system"], required: true },
    actorId:   { type: mongoose.Schema.Types.ObjectId, refPath: "actorType" }, 
    action:    { type: String, required: true }, 
    targetType:{ type: String, default: "" },  
    targetId:  { type: mongoose.Schema.Types.ObjectId },
    details:   { type: String, default: "" },
    ip:        { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("AuditLog", auditLogSchema);
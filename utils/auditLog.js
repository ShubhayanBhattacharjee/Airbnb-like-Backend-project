import AuditLog from "../models/auditLog.js";

export const logAudit = async ({ actorType, actorId, action, targetType = "", targetId = null, details = "", ip = "" }) => {
    try {
        await AuditLog.create({ actorType, actorId, action, targetType, targetId, details, ip });
    } catch (err) {
        console.error("Audit log write failed:", err.message);
    }
};
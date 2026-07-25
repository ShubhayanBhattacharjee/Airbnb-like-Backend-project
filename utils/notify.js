import Notification from "../models/notification.js";

export const notify = async ({ userId, type, title, message = "", link = "", icon = "", meta = {} }) => {
    try {
        if (!userId || !type || !title) return null;
        return await Notification.create({ user: userId, type, title, message, link, icon, meta });
    } catch (err) {
        console.error("Notification write failed:", err.message);
        return null;
    }
};

export const notifyMany = async (userIds = [], { type, title, message = "", link = "", icon = "", meta = {} }) => {
    try {
        const ids = [...new Set(userIds.filter(Boolean).map(id => id.toString()))];
        if (ids.length === 0) return [];
        const docs = ids.map(user => ({ user, type, title, message, link, icon, meta }));
        return await Notification.insertMany(docs);
    } catch (err) {
        console.error("Bulk notification write failed:", err.message);
        return [];
    }
};

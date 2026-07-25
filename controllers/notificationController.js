import mongoose from "mongoose";
import Notification from "../models/notification.js";

const PAGE_SIZE = 5;

export const getNotifications = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const filter = req.query.filter === "unread" ? { isRead: false } : {};
        const query = { user: req.user._id, ...filter };

        const [notifications, unreadCount, totalCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE),
            Notification.countDocuments({ user: req.user._id, isRead: false }),
            Notification.countDocuments(query)
        ]);

        res.json({
            notifications,
            unreadCount,
            page,
            hasMore: page * PAGE_SIZE < totalCount
        });
    } catch (err) {
        next(err);
    }
};

export const getUnreadCount = async (req, res, next) => {
    try {
        const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
        res.json({ unreadCount });
    } catch (err) {
        next(err);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid notification id" });
        }
        const notification = await Notification.findOneAndUpdate(
            { _id: id, user: req.user._id },
            { $set: { isRead: true } },
            { new: true }
        );
        if (!notification) return res.status(404).json({ error: "Notification not found" });
        const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
        res.json({ success: true, notification, unreadCount });
    } catch (err) {
        next(err);
    }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true, unreadCount: 0 });
    } catch (err) {
        next(err);
    }
};

export const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid notification id" });
        }
        const deleted = await Notification.findOneAndDelete({ _id: id, user: req.user._id });
        if (!deleted) return res.status(404).json({ error: "Notification not found" });
        const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
        res.json({ success: true, unreadCount });
    } catch (err) {
        next(err);
    }
};

export const deleteAllNotifications = async (req, res, next) => {
    try {
        await Notification.deleteMany({ user: req.user._id });
        res.json({ success: true, unreadCount: 0 });
    } catch (err) {
        next(err);
    }
};

export const notificationController = {getNotifications, getUnreadCount, markAsRead, markAllAsRead,deleteNotification,deleteAllNotifications};

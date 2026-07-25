import express from "express";
import { notificationController } from "../controllers/notificationController.js";

const notificationRouter = express.Router();

const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
};

notificationRouter.get("/notifications", requireAuth, notificationController.getNotifications);
notificationRouter.get("/notifications/unread-count", requireAuth, notificationController.getUnreadCount);
notificationRouter.post("/notifications/read-all", requireAuth, notificationController.markAllAsRead);
notificationRouter.post("/notifications/:id/read", requireAuth, notificationController.markAsRead);
notificationRouter.delete("/notifications/:id", requireAuth, notificationController.deleteNotification);
notificationRouter.delete("/notifications", requireAuth, notificationController.deleteAllNotifications);

export default notificationRouter;

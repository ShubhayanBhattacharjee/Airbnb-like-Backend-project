import express from "express";
import { adminController } from "../controllers/adminController.js";
import { adminLoginLimiter } from "../middlewares/rateLimit.js";

const adminRouter = express.Router();
const isAdmin = (req, res, next) => {
    if (!req.session.adminId) return res.redirect('/admin/login');
    next();
};

adminRouter.get('/login',  adminController.getLogin);
adminRouter.post('/login', adminLoginLimiter, adminController.postLogin);

adminRouter.post('/logout', isAdmin, adminController.postLogout);

adminRouter.get('/dashboard', isAdmin, adminController.getDashboard);

adminRouter.get('/users',                    isAdmin, adminController.getUsers);
adminRouter.post('/users/:id/ban',           isAdmin, adminController.banUser);
adminRouter.post('/users/:id/unban',         isAdmin, adminController.unbanUser);
adminRouter.post('/users/:id/delete',        isAdmin, adminController.deleteUser);
adminRouter.post('/users/:id/change-role',   isAdmin, adminController.changeUserRole);

adminRouter.get('/listings',                  isAdmin, adminController.getListings);
adminRouter.post('/listings/:id/flag',        isAdmin, adminController.flagListing);
adminRouter.post('/listings/:id/unflag',      isAdmin, adminController.unflagListing);
adminRouter.post('/listings/:id/hide',        isAdmin, adminController.hideListing);
adminRouter.post('/listings/:id/unhide',      isAdmin, adminController.unhideListing);
adminRouter.post('/listings/:id/delete',      isAdmin, adminController.deleteListing);

adminRouter.get('/bookings', isAdmin, adminController.getBookings);

adminRouter.get('/payouts',                  isAdmin, adminController.getPayouts);
adminRouter.post('/payouts/:id/mark-paid',   isAdmin, adminController.markPayoutPaid);
adminRouter.post('/payouts/:id/mark-failed', isAdmin, adminController.markPayoutFailed);

adminRouter.get('/reviews',               isAdmin, adminController.getReviews);
adminRouter.post('/reviews/:id/flag',     isAdmin, adminController.flagReview);
adminRouter.post('/reviews/:id/unflag',   isAdmin, adminController.unflagReview);
adminRouter.post('/reviews/:id/delete',   isAdmin, adminController.deleteReview);

export default adminRouter;
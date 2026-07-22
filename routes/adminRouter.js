import express from "express";
import { adminController } from "../controllers/adminController.js";
import { adminLoginLimiter } from "../middlewares/rateLimit.js";

const adminRouter = express.Router();
const isAdmin = (req, res, next) => {
    if (!req.session.adminId) return res.redirect('/admin/login');
    next();
};
const isSuperAdmin = (req, res, next) => {
    if (!req.session.adminId) return res.redirect('/admin/login');
    if (req.session.adminRole !== 'super_admin') {
        return res.status(403).send('This action requires super-admin access');
    }
    next();
};

adminRouter.get('/login',  adminController.getLogin);
adminRouter.post('/login', adminLoginLimiter, adminController.postLogin);

adminRouter.post('/logout', isAdmin, adminController.postLogout);

adminRouter.get('/dashboard', isAdmin, adminController.getDashboard);

adminRouter.get('/users',                    isAdmin, adminController.getUsers);
adminRouter.post('/users/:id/ban',           isAdmin, adminController.banUser);
adminRouter.post('/users/:id/unban',         isAdmin, adminController.unbanUser);
adminRouter.post('/users/:id/change-role',   isAdmin, adminController.changeUserRole);
adminRouter.post('/users/:id/delete',        isSuperAdmin, adminController.deleteUser);

adminRouter.get('/listings',                  isAdmin, adminController.getListings);
adminRouter.post('/listings/:id/flag',        isAdmin, adminController.flagListing);
adminRouter.post('/listings/:id/unflag',      isAdmin, adminController.unflagListing);
adminRouter.post('/listings/:id/hide',        isAdmin, adminController.hideListing);
adminRouter.post('/listings/:id/unhide',      isAdmin, adminController.unhideListing);
adminRouter.post('/listings/:id/delete',     isSuperAdmin, adminController.deleteListing);
adminRouter.post('/listings/:id/commission', isSuperAdmin, adminController.setListingCommission);

adminRouter.get('/bookings', isAdmin, adminController.getBookings);

adminRouter.get('/payouts',                  isAdmin, adminController.getPayouts);
adminRouter.post('/payouts/:id/mark-paid',   isSuperAdmin, adminController.markPayoutPaid);
adminRouter.post('/payouts/:id/mark-failed', isSuperAdmin, adminController.markPayoutFailed);
adminRouter.post('/payouts/process-due', isSuperAdmin, adminController.processDuePayouts);
adminRouter.post('/payouts/:id/retry',   isSuperAdmin, adminController.retryPayout);

adminRouter.get('/reviews',               isAdmin, adminController.getReviews);
adminRouter.post('/reviews/:id/flag',     isAdmin, adminController.flagReview);
adminRouter.post('/reviews/:id/unflag',   isAdmin, adminController.unflagReview);
adminRouter.post('/reviews/:id/delete',   isSuperAdmin, adminController.deleteReview);

adminRouter.get('/auditLog',isAdmin, adminController.getAuditLog);

adminRouter.post('/payouts/bulk-mark-paid', isSuperAdmin, adminController.bulkMarkPayoutsPaid);
adminRouter.post('/payouts/bulk-retry',     isSuperAdmin, adminController.bulkRetryPayouts);
adminRouter.get('/reports/export',          isSuperAdmin, adminController.exportFinancialReport);

export default adminRouter;
import express from 'express';
import { listIssues, getIssue, updateStatus } from '../controllers/issueController.js';


const adminIssuesRouter = express.Router();
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

adminIssuesRouter.get('/admin/issues', isAdmin, listIssues);
adminIssuesRouter.get('/admin/issues/:id', isAdmin, getIssue);
adminIssuesRouter.post('/admin/issues/:id/status', isSuperAdmin, updateStatus);

export default adminIssuesRouter;
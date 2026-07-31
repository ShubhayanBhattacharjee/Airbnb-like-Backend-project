import express from 'express';
import { createIssue, listMyIssues, getMyIssue } from '../controllers/issueController.js';
import { contactLimiter } from '../middlewares/rateLimit.js';

const issueRouter = express.Router();

const requireLogin = (req, res, next) => {
  if (!req.session.isLoggedIn || !req.user) {
    return res.redirect('/login');
  }
  next();
};

issueRouter.post('/contact/support', requireLogin, contactLimiter, createIssue);
issueRouter.get('/my-issues', requireLogin, listMyIssues);
issueRouter.get('/my-issues/:id', requireLogin, getMyIssue);

export default issueRouter; 
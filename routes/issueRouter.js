import express from 'express';
import { createIssue } from '../controllers/issueController.js';
import { contactLimiter } from '../middlewares/rateLimit.js';

const issueRouter = express.Router();

const requireLogin = (req, res, next) => {
  if (!req.session.isLoggedIn || !req.user) {
    return res.redirect('/login');
  }
  next();
};

issueRouter.post('/contact/support', requireLogin, contactLimiter, createIssue);

export default issueRouter;
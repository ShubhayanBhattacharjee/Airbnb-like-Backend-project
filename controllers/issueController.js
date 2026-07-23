import mongoose from 'mongoose';
import Issue from '../models/issue.js';
import { sendEmail } from '../utils/sendEmail.js';
import { logAudit } from '../utils/auditLog.js';

const ISSUE_TYPES = ['booking', 'payment', 'account', 'listing', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export const createIssue = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    const {
      name,
      email,
      booking_id,
      property_id,
      issue_type,
      subject,
      message,
    } = req.body;

    const role = req.user.role === 'host' ? 'host' : 'guest';

    if (!ISSUE_TYPES.includes(issue_type)) {
      return res.status(400).render('contact', {
        pageTitle: 'Contact',
        path: '/contact',
        error: 'Please select a valid issue type.',
      });
    }
    if (!name || !email || !subject || !message) {
      return res.status(400).render('contact', {
        pageTitle: 'Contact',
        path: '/contact',
        error: 'Please fill in all required fields.',
      });
    }

    const validBookingId = role === 'guest' && booking_id && mongoose.isValidObjectId(booking_id)
      ? booking_id
      : null;
    const validPropertyId = role === 'host' && property_id && mongoose.isValidObjectId(property_id)
      ? property_id
      : null;

    let fullMessage = message;
    if (role === 'guest' && booking_id && !validBookingId) {
      fullMessage = `[Booking reference given: ${booking_id}]\n\n${message}`;
    }
    if (role === 'host' && property_id && !validPropertyId) {
      fullMessage = `[Property reference given: ${property_id}]\n\n${message}`;
    }

    const issue = await Issue.create({
      role,
      name,
      email,
      bookingId: validBookingId,
      propertyId: validPropertyId,
      issueType: issue_type,
      subject,
      message: fullMessage,
    });

    const ref = issue._id.toString().slice(-6).toUpperCase();
    sendEmail(
      email,
      `We've received your request — Ref #${ref}`,
      `<p>Hi ${name},</p>
             <p>Thanks for reaching out. Our support team will get back to you within 24 hours.</p>
             <p>Reference: <strong>${ref}</strong></p>`
    ).catch((err) => console.error('Confirmation email failed:', err));

    sendEmail(
      process.env.SUPPORT_EMAIL || 'hello@homestays.com',
      `[${role.toUpperCase()}] ${subject} (Ref #${ref})`,
      `<p>Role: ${role}</p>
             <p>From: ${name} (${email})</p>
             <p>Type: ${issue_type}</p>
             <p>${message}</p>
             <p><a href="${process.env.APP_URL || ''}/admin/issues/${issue._id}">View in admin</a></p>`
    ).catch((err) => console.error('Support notification failed:', err));

    return res.render('contact', { pageTitle: 'Contact', path: '/contact', success: true });
  } catch (err) {
    console.error('createIssue error:', err);
    return res.status(500).render('contact', {
      pageTitle: 'Contact',
      path: '/contact',
      error: 'Something went wrong submitting your request. Please try again.',
    });
  }
};

export const listIssues = async (req, res) => {
  try {
    const { status, role, q, page = 1 } = req.query;
    const filter = {};
    if (status && STATUSES.includes(status)) filter.status = status;
    if (role && ['guest', 'host'].includes(role)) filter.role = role;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { subject: new RegExp(q, 'i') },
      ];
    }

    const perPage = 20;
    const currentPage = parseInt(page, 10) || 1;

    const [issues, total, counts] = await Promise.all([
      Issue.find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * perPage)
        .limit(perPage),
      Issue.countDocuments(filter),
      Issue.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const statusCounts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    counts.forEach((c) => {
      statusCounts[c._id] = c.count;
    });

    res.render('admin/issues', {
      issues,
      statusCounts,
      total,
      currentPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      filters: { status: status || '', role: role || '', q: q || '' },
    });
  } catch (err) {
    console.error('listIssues error:', err);
    res.status(500).send('Could not load issues.');
  }
};

export const getIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('bookingId')
      .populate('propertyId')
      .populate('assignedTo', 'name email')
      .populate('resolution.resolvedBy', 'name email');

    if (!issue) return res.status(404).render('404');
    res.render('admin/issue-detail', { issue });
  } catch (err) {
    console.error('getIssue error:', err);
    res.status(500).send('Could not load issue.');
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { status, resolution_note } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).send('Invalid status.');
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).render('404');

    issue.status = status;
    if (status === 'resolved') {
      issue.resolution.note = resolution_note || issue.resolution.note;
      issue.resolution.resolvedBy = req.session.adminId || null;
      issue.resolution.resolvedAt = new Date();
    }
    await issue.save();

    await logAudit({
      actorType: 'admin',
      actorId: req.session.adminId,
      action: 'issue_status_updated',
      targetType: 'Issue',
      targetId: issue._id,
      details: `Status set to "${status}"${status === 'resolved' ? ` — note: ${issue.resolution.note}` : ''}`,
      ip: req.ip,
    });

    res.redirect(`/admin/issues/${issue._id}`);
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).send('Could not update issue.');
  }
};
import mongoose from 'mongoose';
import Issue from '../models/issue.js';
import Booking from '../models/booking.js';
import Home from '../models/home.js';
import { sendEmail } from '../utils/sendEmail.js';
import { logAudit } from '../utils/auditLog.js';
import { notify } from '../utils/notify.js';

const ISSUE_TYPES = ['booking', 'payment', 'account', 'listing', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// Re-fetches the same booking/property lists the contact page uses, so that
// error re-renders show the exact same (valid) options the user picked from.
const loadTicketableItems = async (user) => {
  let myBookings = [];
  let myProperties = [];

  if (!user) return { myBookings, myProperties };

  if (user.role === 'host') {
    const homes = await Home.find({ owner: user._id }).select('_id houseName city state').lean();
    const homeIds = homes.map((h) => h._id);
    const bookedHomeIds = homeIds.length
      ? await Booking.distinct('home', { home: { $in: homeIds } })
      : [];
    const bookedSet = new Set(bookedHomeIds.map((id) => id.toString()));
    myProperties = homes.filter((h) => bookedSet.has(h._id.toString()));
  } else {
    myBookings = await Booking.find({ guest: user._id })
      .populate('home', 'houseName city state')
      .sort({ createdAt: -1 })
      .select('bookingId home checkIn checkOut status')
      .lean();
  }

  return { myBookings, myProperties };
};

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

    const rerenderWithError = async (error) => {
      const { myBookings, myProperties } = await loadTicketableItems(req.user);
      return res.status(400).render('contact', {
        pageTitle: 'Contact',
        path: '/contact',
        error,
        myBookings,
        myProperties,
      });
    };

    if (!ISSUE_TYPES.includes(issue_type)) {
      return rerenderWithError('Please select a valid issue type.');
    }
    if (!name || !email || !subject || !message) {
      return rerenderWithError('Please fill in all required fields.');
    }

    // A ticket can only ever be raised against a booking/property that
    // genuinely belongs to (and, for hosts, has been booked on) this user.
    // Nothing here is taken from free text — everything is re-verified
    // against the database, ignoring whatever the client sent.
    let validBookingId = null;
    let validPropertyId = null;

    if (role === 'guest') {
      if (!booking_id || !mongoose.isValidObjectId(booking_id)) {
        return rerenderWithError('Please select the booking this ticket relates to.');
      }
      const booking = await Booking.findOne({ _id: booking_id, guest: req.user._id }).select('_id').lean();
      if (!booking) {
        return rerenderWithError('That booking could not be found on your account. You can only raise a ticket for a booking you\'ve actually made.');
      }
      validBookingId = booking._id;
    } else {
      if (!property_id || !mongoose.isValidObjectId(property_id)) {
        return rerenderWithError('Please select the property this ticket relates to.');
      }
      const home = await Home.findOne({ _id: property_id, owner: req.user._id }).select('_id').lean();
      if (!home) {
        return rerenderWithError('That property could not be found on your account.');
      }
      const hasBooking = await Booking.exists({ home: home._id });
      if (!hasBooking) {
        return rerenderWithError('You can only raise a ticket for a property that has at least one booking made against it.');
      }
      validPropertyId = home._id;
    }

    const issue = await Issue.create({
      role,
      userId: req.user._id,
      name,
      email,
      bookingId: validBookingId,
      propertyId: validPropertyId,
      issueType: issue_type,
      subject,
      message,
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
      process.env.SUPPORT_EMAIL || 'hello@roovia.com',
      `[${role.toUpperCase()}] ${subject} (Ref #${ref})`,
      `<p>Role: ${role}</p>
             <p>From: ${name} (${email})</p>
             <p>Type: ${issue_type}</p>
             <p>${message}</p>
             <p><a href="${process.env.APP_URL || ''}/admin/issues/${issue._id}">View in admin</a></p>`
    ).catch((err) => console.error('Support notification failed:', err));

    const { myBookings, myProperties } = await loadTicketableItems(req.user);
    return res.render('contact', { pageTitle: 'Contact', path: '/contact', success: true, myBookings, myProperties });
  } catch (err) {
    console.error('createIssue error:', err);
    const { myBookings, myProperties } = await loadTicketableItems(req.user).catch(() => ({ myBookings: [], myProperties: [] }));
    return res.status(500).render('contact', {
      pageTitle: 'Contact',
      path: '/contact',
      error: 'Something went wrong submitting your request. Please try again.',
      myBookings,
      myProperties,
    });
  }
};

export const listMyIssues = async (req, res) => {
  try {
    const issues = await Issue.find({ userId: req.user._id })
      .populate('bookingId', 'bookingId checkIn checkOut home')
      .populate('propertyId', 'houseName city state')
      .sort({ createdAt: -1 });
    res.render('my-issues', { pageTitle: 'My support tickets', issues });
  } catch (err) {
    console.error('listMyIssues error:', err);
    res.status(500).send('Could not load your tickets.');
  }
};

export const getMyIssue = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).render('404');
    const issue = await Issue.findOne({ _id: req.params.id, userId: req.user._id })
      .populate({
        path: 'bookingId',
        select: 'bookingId checkIn checkOut nights guests totalPrice status home',
        populate: { path: 'home', select: 'houseName city state' },
      })
      .populate('propertyId', 'houseName city state');
    if (!issue) return res.status(404).render('404');
    res.render('my-issue-detail', { pageTitle: 'Ticket detail', issue });
  } catch (err) {
    console.error('getMyIssue error:', err);
    res.status(500).send('Could not load ticket.');
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

    const STATUS_LABELS = {
      open: 'Open',
      in_progress: 'In progress',
      resolved: 'Resolved',
      closed: 'Closed',
    };

    notify({
      userId: issue.userId,
      type: status === 'resolved' ? 'issue_resolved' : 'issue_status_updated',
      title: `Ticket "${issue.subject}" — ${STATUS_LABELS[status]}`,
      message: status === 'resolved' && issue.resolution.note
        ? issue.resolution.note
        : `Your support ticket status changed to ${STATUS_LABELS[status]}.`,
      link: `/my-issues/${issue._id}`,
      icon: status === 'resolved' ? 'ri-checkbox-circle-line' : 'ri-information-line',
    }).catch((err) => console.error('Issue notify failed:', err.message));

    sendEmail(
      issue.email,
      `Update on your request — Ref #${issue._id.toString().slice(-6).toUpperCase()}`,
      `<p>Hi ${issue.name},</p>
             <p>Your support ticket "<strong>${issue.subject}</strong>" is now <strong>${STATUS_LABELS[status]}</strong>.</p>
             ${status === 'resolved' && issue.resolution.note ? `<p>${issue.resolution.note}</p>` : ''}
             <p><a href="${process.env.APP_URL || ''}/my-issues/${issue._id}">View ticket</a></p>`
    ).catch((err) => console.error('Issue status email failed:', err));

    res.redirect(`/admin/issues/${issue._id}`);
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).send('Could not update issue.');
  }
};
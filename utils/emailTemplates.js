export const bookingConfirmedTemplate = (guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#1a1a2e;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#9ad;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">You're all set, ${guestName.split(' ')[0] || guestName} ✓</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:14px;color:#6b7280;">Your bags can start packing themselves — this stay is locked in and paid for. Here's everything you need:</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 4px;font-size:17px;color:#1a1a2e;">${home.houseName}</h3>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">📍 ${home.location}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">
      <table style="width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;"><strong>Check-in</strong></td>
          <td style="text-align:right;">${new Date(booking.checkIn).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Check-out</strong></td>
          <td style="text-align:right;">${new Date(booking.checkOut).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Duration</strong></td>
          <td style="text-align:right;">${booking.nights} night${booking.nights !== 1 ? 's' : ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Guests</strong></td>
          <td style="text-align:right;">${booking.guests}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:8px 0 0;"><strong>Total Paid</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:12px;color:#9ca3af;">Payment ID: ${booking.razorpayPaymentId}</p>
    <p style="font-size:13px;color:#6b7280;">Sit back, count down the days, and get ready to swap your keys for a good time. Need anything before you go? Just reply to this email.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const hostNewBookingTemplate = (hostName, guestName, booking, home, guestEmail, guestPhone) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#1a1a2e;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#9ad;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">Cha-ching! New booking 🎉</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;"><strong>${guestName}</strong> just booked <strong>${home.houseName}</strong>. Time to get the welcome mat out.</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">${home.houseName}</h3>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">
      <table style="width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;"><strong>Guest</strong></td>
          <td style="text-align:right;">${guestName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Guest Email</strong></td>
          <td style="text-align:right;"><a href="mailto:${guestEmail}" style="color:#2563eb;">${guestEmail}</a></td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Guest Phone</strong></td>
          <td style="text-align:right;">${guestPhone || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Check-in</strong></td>
          <td style="text-align:right;">${new Date(booking.checkIn).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Check-out</strong></td>
          <td style="text-align:right;">${new Date(booking.checkOut).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Duration</strong></td>
          <td style="text-align:right;">${booking.nights} night${booking.nights !== 1 ? 's' : ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Guests</strong></td>
          <td style="text-align:right;">${booking.guests}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Booking Total</strong></td>
          <td style="text-align:right;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Platform Commission (${booking.platformCommissionPercent}%)</strong></td>
          <td style="text-align:right;color:#dc2626;">− ₹${booking.platformCommission.toLocaleString('en-IN')}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:8px 0 0;"><strong>You'll Earn</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.payoutAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6b7280;">
      That <strong>₹${booking.payoutAmount.toLocaleString('en-IN')}</strong> lands in your registered bank/UPI account within 3 days of check-out (by
      ${new Date(booking.payoutDueDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}).
      Double-check your payout details in your dashboard so nothing holds it up.
    </p>
    <p style="font-size:13px;color:#6b7280;">Full booking details are waiting in your dashboard.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const bookingCancelledGuestTemplate = (guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#991b1b;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#fecaca;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">Trip cancelled</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${guestName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Consider it done — your booking's been cancelled. Here's the summary for your records:</p>

    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 4px;font-size:16px;color:#1a1a2e;">${home.houseName}</h3>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">📍 ${home.location}</p>
      <hr style="border:none;border-top:1px solid #fecaca;margin:12px 0;">
      <table style="width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;"><strong>Check-in</strong></td>
          <td style="text-align:right;">${new Date(booking.checkIn).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Check-out</strong></td>
          <td style="text-align:right;">${new Date(booking.checkOut).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Amount Paid</strong></td>
          <td style="text-align:right;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
        <tr style="border-top:1px solid #fecaca;">
          <td style="padding:8px 0 0;"><strong>Refund (${booking.refundPercent}%)</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.refundAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fef3c7;border-radius:8px;padding:12px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        ${booking.refundAmount > 0
          ? `<strong>Refund note:</strong> ₹${booking.refundAmount.toLocaleString('en-IN')} is on its way back to your original payment method — usually within 5–7 business days.`
          : `<strong>Refund note:</strong> Based on this home's cancellation policy and how close to check-in this was, this one isn't refundable. We know that's not the news you wanted.`}
      </p>
    </div>

    <p style="font-size:13px;color:#6b7280;">The world's still full of quiet places worth visiting — whenever you're ready, we'll be here.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const hostBookingCancelledTemplate = (hostName, guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#92400e;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#fde68a;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">A guest just cancelled</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;"><strong>${guestName}</strong> won't be making it to <strong>${home.houseName}</strong> after all — here's where things stand.</p>

    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">${home.houseName}</h3>
      <hr style="border:none;border-top:1px solid #fecaca;margin:12px 0;">
      <table style="width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;"><strong>Guest</strong></td>
          <td style="text-align:right;">${guestName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Check-in</strong></td>
          <td style="text-align:right;">${new Date(booking.checkIn).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Check-out</strong></td>
          <td style="text-align:right;">${new Date(booking.checkOut).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Booking Value</strong></td>
          <td style="text-align:right;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
        <tr style="border-top:1px solid #fecaca;">
          <td style="padding:8px 0 0;"><strong>Your Compensation</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.payoutAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6b7280;">
      ${booking.payoutAmount > 0
        ? `You'll get ₹${booking.payoutAmount.toLocaleString('en-IN')} as compensation for the short-notice cancellation, paid within 3 days. `
        : ''}Those dates are open again — go fill them with your next great guest.
    </p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const hostBookingModifiedTemplate = (hostName, guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#0369a1;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#bae6fd;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">Plans just shifted 📅</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;"><strong>${guestName}</strong> updated their dates for <strong>${home.houseName}</strong>. Here's the new plan:</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;"><strong>New Check-in</strong></td>
          <td style="text-align:right;">${new Date(booking.checkIn).toLocaleDateString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>New Check-out</strong></td>
          <td style="text-align:right;">${new Date(booking.checkOut).toLocaleDateString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Guests</strong></td>
          <td style="text-align:right;">${booking.guests}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:8px 0 0;"><strong>Updated Payout</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.payoutAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6b7280;">Mark your calendar accordingly — the full updated booking is in your dashboard.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const hostPayoutSentTemplate = (hostName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#166534;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#bbf7d0;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">Payout sent 💸</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Good news for your bank balance — your payout for <strong>${home.houseName}</strong> is on its way to your registered ${booking.payoutMethod || "account"}.</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;"><strong>Booking Total</strong></td>
          <td style="text-align:right;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Platform Commission (${booking.platformCommissionPercent}%)</strong></td>
          <td style="text-align:right;color:#dc2626;">− ₹${booking.platformCommission.toLocaleString('en-IN')}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:8px 0 0;"><strong>Amount Paid Out</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.payoutAmount.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0 0;"><strong>Reference</strong></td>
          <td style="text-align:right;padding:8px 0 0;">${booking.payoutReference}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6b7280;">Your full payout history is always one login away in your dashboard.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const hostCancelledGuestTemplate = (guestName, booking, home, note) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#991b1b;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#fecaca;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">Your host had to cancel</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${guestName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Not the email we like sending — your stay at <strong>${home.houseName}</strong> was cancelled by the host.</p>
    <div style="background:#fef3c7;border-radius:8px;padding:12px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#92400e;">${note}</p>
    </div>
    <p style="font-size:13px;color:#374151;">You've been fully refunded <strong>₹${booking.totalPrice.toLocaleString('en-IN')}</strong>, landing back in your account within 5–7 business days.</p>
    <p style="font-size:13px;color:#6b7280;">Sorry for the shuffle — there are plenty of other quiet places waiting whenever you're ready to look.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
  </div>
</div>
`;

export const newsletterConfirmationTemplate = (email) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#1a1a2e;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <p style="color:#9ad;letter-spacing:2px;font-size:11px;margin:0 0 6px;text-transform:uppercase;">Roovia</p>
    <h1 style="color:#fff;margin:0;font-size:22px;">Welcome to the list 🎉</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:14px;color:#374151;">Hi there,</p>
    <p style="font-size:14px;color:#6b7280;"><strong>${email}</strong> is officially on the list. Expect the occasional email full of quiet corners, unusual stays, and the odd deal worth packing a bag for.</p>
    <p style="font-size:13px;color:#374151;">— The Roovia Team<br><span style="color:#9ca3af;font-size:12px;">Stays with soul.</span></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <p style="font-size:11px;color:#9ca3af;">Changed your mind? <a href="http://localhost:3000/newsletter/unsubscribe?email=${encodeURIComponent(email)}" style="color:#2563eb;text-decoration:underline;">Unsubscribe here</a>.</p>
  </div>
</div>
`;
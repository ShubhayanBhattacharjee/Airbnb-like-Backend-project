export const bookingConfirmedTemplate = (guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#1a1a2e;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Booking Confirmed ✓</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${guestName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Your booking has been confirmed and payment received. Here are your stay details:</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">${home.houseName}</h3>
      <p style="margin:4px 0;font-size:13px;color:#6b7280;">📍 ${home.location}</p>
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
    <p style="font-size:13px;color:#6b7280;">We hope you have a wonderful stay. If you need help, reply to this email.</p>
    <p style="font-size:13px;color:#374151;">— The HomeStays Team</p>
  </div>
</div>
`;

export const hostNewBookingTemplate = (hostName, guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#1a1a2e;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">New Booking Received 🎉</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Great news! <strong>${guestName}</strong> has booked your property.</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">${home.houseName}</h3>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">
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
          <td style="padding:4px 0;"><strong>Duration</strong></td>
          <td style="text-align:right;">${booking.nights} night${booking.nights !== 1 ? 's' : ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Guests</strong></td>
          <td style="text-align:right;">${booking.guests}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:8px 0 0;"><strong>You'll Earn</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#166534;padding:8px 0 0;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6b7280;">Log in to your dashboard to view the full booking details.</p>
    <p style="font-size:13px;color:#374151;">— The HomeStays Team</p>
  </div>
</div>
`;

export const bookingCancelledGuestTemplate = (guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#991b1b;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Booking Cancelled</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${guestName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Your booking has been successfully cancelled. Here's a summary:</p>

    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">${home.houseName}</h3>
      <p style="margin:4px 0;font-size:13px;color:#6b7280;">📍 ${home.location}</p>
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
        <tr style="border-top:1px solid #fecaca;">
          <td style="padding:8px 0 0;"><strong>Amount Paid</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#991b1b;padding:8px 0 0;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fef3c7;border-radius:8px;padding:12px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        <strong>Refund Note:</strong> If you are eligible for a refund, it will be initiated within 5-7 business days to your original payment method.
      </p>
    </div>

    <p style="font-size:13px;color:#6b7280;">We hope to host you again soon.</p>
    <p style="font-size:13px;color:#374151;">— The HomeStays Team</p>
  </div>
</div>
`;

export const hostBookingCancelledTemplate = (hostName, guestName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#92400e;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Booking Cancelled by Guest</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;"><strong>${guestName}</strong> has cancelled their booking for your property.</p>

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
        <tr style="border-top:1px solid #fecaca;">
          <td style="padding:8px 0 0;"><strong>Booking Value</strong></td>
          <td style="text-align:right;font-size:16px;font-weight:700;color:#991b1b;padding:8px 0 0;">₹${booking.totalPrice.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#6b7280;">Those dates are now available for new bookings.</p>
    <p style="font-size:13px;color:#374151;">— The HomeStays Team</p>
  </div>
</div>
`;

export const hostPayoutSentTemplate = (hostName, booking, home) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
  <div style="background:#166534;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Payout Sent 💸</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="font-size:15px;color:#374151;">Hi <strong>${hostName}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;">Your payout for the stay at <strong>${home.houseName}</strong> has been sent to your registered ${booking.payoutMethod || "account"}.</p>
 
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
 
    <p style="font-size:13px;color:#6b7280;">Log in to your dashboard to view your full payout history.</p>
    <p style="font-size:13px;color:#374151;">— The HomeStays Team</p>
  </div>
</div>
`;

import Newsletter from "../models/newsletter.js";
import { sendEmail } from "../utils/sendEmail.js";
import { newsletterConfirmationTemplate } from "../utils/emailTemplates.js";

const subscribe = async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email." });
  }

  try {
    const existing = await Newsletter.findOne({ email: email.toLowerCase() });

    if (existing) {
      return res.status(200).json({ success: true, message: "You're already subscribed!" });
    }

    await Newsletter.create({ email });

    // Respond immediately — don't block the UI on the SMTP round trip
    res.status(200).json({ success: true, message: "Thanks for subscribing! Check your inbox." });

    // Fire the email off after responding; log if it fails, but the user's already been told it worked
    sendEmail(email, "Thanks for subscribing to Roovia", newsletterConfirmationTemplate(email))
      .catch(err => console.error("Newsletter confirmation email failed:", err));

  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};
const unsubscribe = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).send("Invalid unsubscribe link.");
  }

  try {
    await Newsletter.deleteOne({ email: email.toLowerCase() });
    res.status(200).send(`
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:60px auto;text-align:center;">
        <h2>You've been unsubscribed</h2>
        <p>${email} will no longer receive the Roovia newsletter.</p>
      </div>
    `);
  } catch (err) {
    console.error("Newsletter unsubscribe error:", err);
    res.status(500).send("Something went wrong. Please try again.");
  }
};

export const newsletterController = { subscribe, unsubscribe };

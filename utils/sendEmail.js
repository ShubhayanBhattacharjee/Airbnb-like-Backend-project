import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            pool: true,
            maxConnections: 5,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }
    return transporter;
}

export const sendEmail = async (to, subject, html) => {
    await getTransporter().sendMail({
        from: `"Airbnb Clone" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
    });
};
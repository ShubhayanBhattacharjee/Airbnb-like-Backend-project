// import nodemailer from "nodemailer";

// let transporter = null;

// function getTransporter() {
//     if (!transporter) {
//         transporter = nodemailer.createTransport({
//             host: "smtp.gmail.com",
//             port: 465,
//             secure: true,
//             pool: true,
//             maxConnections: 5,
//             family: 4,
//             connectionTimeout: 10000,
//             greetingTimeout: 10000,
//             socketTimeout: 10000,
//             auth: {
//                 user: process.env.EMAIL_USER,
//                 pass: process.env.EMAIL_PASSWORD
//             }
//         });
//     }
//     return transporter;
// }

// export const sendEmail = async (to, subject, html) => {
//     await getTransporter().sendMail({
//         from: `"Roovia" <${process.env.EMAIL_USER}>`,
//         to,
//         subject,
//         html
//     });
// };


//since free render deployment dont support delivering mail using google mailboxes
export const sendEmail = async (to, subject, html) => {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: "Roovia <onboarding@resend.dev>",
            to,
            subject,
            html
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Resend API error (${response.status}): ${errorBody}`);
    }
};
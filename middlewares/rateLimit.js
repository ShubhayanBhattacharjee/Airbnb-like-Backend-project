import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        res.status(429).render("auth/login", {
            pageTitle: "Login",
            isLoggedIn: false,
            errors: [
                "Too many login attempts. Please try again after 15 minutes."
            ],
            oldInput: { email: "" },
            user: {}
        });
    }
});

export const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 3,                      // max 3 requests per IP per hour
    message: "Too many password reset requests. Please try again in an hour.",
    standardHeaders: true,
    legacyHeaders: false,
});

export const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        res.status(429).render("admin/login", {
            pageTitle: "Admin Login",
            error: "Too many login attempts. Please try again after 15 minutes."
        });
    }
});
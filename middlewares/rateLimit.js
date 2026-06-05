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
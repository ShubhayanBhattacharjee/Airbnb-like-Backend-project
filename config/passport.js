import dotenv from "dotenv";
dotenv.config();
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.js";

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Case 1: already a Google user
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Case 2: email exists but signed up manually — link accounts
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
            user.googleId = profile.id;
            if (!user.profileImage || user.profileImage === "/images/about-hero.png") {
                user.profileImage = profile.photos[0]?.value;
            }
            await user.save();
            return done(null, user);
        }

        // Case 3: brand new user
        user = new User({
            googleId: profile.id,
            fname: profile.name.givenName,
            lname: profile.name.familyName || ".",
            email: profile.emails[0].value,
            profileImage: profile.photos[0]?.value || "/images/about-hero.png",
            isVerified: true,   // Google already verified the email
            needsRole: true     // must pick role before using app
        });
        await user.save();
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));
passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});
export default passport;
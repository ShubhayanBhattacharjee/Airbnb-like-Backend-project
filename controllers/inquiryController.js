import Inquiry from "../models/inquiry.js";
import Home from "../models/home.js";
import { notify } from "../utils/notify.js";
import { recomputeHostStats } from "../utils/hostStats.js";

// Guest asks a question from the listing page
export const postAskQuestion = async (req, res, next) => {
    try {
        const { homeId, message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Please enter a question." });
        }
        const home = await Home.findById(homeId).select("owner houseName");
        if (!home) return res.status(404).json({ success: false, message: "Listing not found." });
        if (home.owner.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: "You can't message yourself." });
        }

        const inquiry = await Inquiry.create({
            home: home._id,
            host: home.owner,
            guest: req.user._id,
            message: message.trim()
        });

        try {
            await notify({
                userId: home.owner,
                type: "new_inquiry",
                title: "New question from a guest",
                message: `${req.user.fname} ${req.user.lname} asked about ${home.houseName}.`,
                link: "/host/inquiries",
                icon: "general",
                meta: { inquiryId: inquiry._id.toString(), homeId: home._id.toString() }
            });
        } catch (notifyErr) {
            console.error("New-inquiry notification failed:", notifyErr.message);
        }

        res.status(200).json({ success: true, message: "Your question was sent to the host." });
    } catch (err) { next(err); }
};

// Host's inbox
export const listMyInquiries = async (req, res, next) => {
    try {
        const filter = { host: req.user._id };
        if (req.query.status === "open" || req.query.status === "answered") {
            filter.status = req.query.status;
        }
        const inquiries = await Inquiry.find(filter)
            .populate("guest", "fname lname profileImage")
            .populate("home", "houseName photos")
            .sort({ status: 1, createdAt: -1 }); // open first
        res.render("host/inquiries", {
            pageTitle: "Guest Questions",
            inquiries,
            statusFilter: req.query.status || "all"
        });
    } catch (err) { next(err); }
};

// Host replies
export const postReplyInquiry = async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).send("Reply cannot be empty");
        }
        const inquiry = await Inquiry.findOne({ _id: req.params.id, host: req.user._id })
            .populate("home", "houseName");
        if (!inquiry) return res.status(404).send("Not found");

        inquiry.reply = { message: message.trim(), repliedAt: new Date() };
        inquiry.status = "answered";
        await inquiry.save();

        try {
            await notify({
                userId: inquiry.guest,
                type: "inquiry_replied",
                title: "The host answered your question",
                message: `${req.user.fname} ${req.user.lname} replied about ${inquiry.home.houseName}.`,
                link: `/homeList/${inquiry.home._id}#host`,
                icon: "general",
                meta: { inquiryId: inquiry._id.toString() }
            });
        } catch (notifyErr) {
            console.error("Inquiry-reply notification failed:", notifyErr.message);
        }

        // recompute this host's stats now that they've answered one
        recomputeHostStats(req.user._id).catch(e => console.error("Host stats recompute failed:", e.message));

        res.redirect("/host/inquiries");
    } catch (err) { next(err); }
};

export const inquiryController = { postAskQuestion, listMyInquiries, postReplyInquiry };
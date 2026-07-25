import Counter from "../models/counter.js";

export async function getNextSequence(name) {
    const counter = await Counter.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

export function formatHostId(seq) {
    return `HOST-${String(seq).padStart(5, "0")}`;
}

export async function ensureHostId(user) {
    if (user.role === "host" && !user.hostId) {
        const seq = await getNextSequence("hostId");
        user.hostId = formatHostId(seq);
    }
    return user;
}

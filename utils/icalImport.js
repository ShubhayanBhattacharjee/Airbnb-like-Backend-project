import ical from "node-ical";

export const fetchExternalEvents = async (url) => {
    const data = await ical.async.fromURL(url);
    const events = [];
    for (const key in data) {
        const item = data[key];
        if (item.type === "VEVENT" && item.start && item.end) {
            events.push({ from: item.start, to: item.end });
        }
    }
    return events;
};
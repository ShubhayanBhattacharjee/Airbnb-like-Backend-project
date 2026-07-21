export const getPriceForDate = (home, date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (home.seasonalPricing && home.seasonalPricing.length > 0) {
        const rule = home.seasonalPricing.find(r => d >= new Date(r.from) && d < new Date(r.to));
        if (rule) return rule.price;
    }
    return home.price;
};

export const getTotalPriceForRange = (home, checkIn, checkOut) => {
    let total = 0;
    const cursor = new Date(checkIn);
    const outDate = new Date(checkOut);
    while (cursor < outDate) {
        total += getPriceForDate(home, cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
    return total;
};
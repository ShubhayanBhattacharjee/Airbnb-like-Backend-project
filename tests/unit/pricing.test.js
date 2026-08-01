import { getPriceForDate, getTotalPriceForRange } from "../../utils/pricing.js";

describe("getPriceForDate", () => {
  it("returns the base price when there is no seasonal rule", () => {
    const home = { price: 2000, seasonalPricing: [] };
    expect(getPriceForDate(home, "2026-09-01")).toBe(2000);
  });

  it("returns the seasonal price when the date falls inside a rule's range", () => {
    const home = {
      price: 2000,
      seasonalPricing: [
        { from: "2026-12-20", to: "2027-01-05", price: 5000 }, // peak season
      ],
    };
    expect(getPriceForDate(home, "2026-12-25")).toBe(5000);
  });

  it("falls back to base price on the day a seasonal rule ends (exclusive 'to')", () => {
    const home = {
      price: 2000,
      seasonalPricing: [{ from: "2026-12-20", to: "2027-01-05", price: 5000 }],
    };
    expect(getPriceForDate(home, "2027-01-05")).toBe(2000);
  });
});

describe("getTotalPriceForRange", () => {
  it("sums base price per night for a simple 3-night stay", () => {
    const home = { price: 2000, seasonalPricing: [] };
    const total = getTotalPriceForRange(home, "2026-09-01", "2026-09-04");
    expect(total).toBe(6000); // 3 nights * 2000
  });

  it("mixes base and seasonal pricing correctly across a straddling range", () => {
    const home = {
      price: 2000,
      seasonalPricing: [{ from: "2026-12-24", to: "2026-12-27", price: 5000 }],
    };
    // Dec 22 -> Dec 26 = 4 nights: 22,23 at base (2000 each), 24,25 at seasonal (5000 each)
    const total = getTotalPriceForRange(home, "2026-12-22", "2026-12-26");
    expect(total).toBe(2000 + 2000 + 5000 + 5000);
  });

  it("returns 0 for a same-day (zero-night) range", () => {
    const home = { price: 2000, seasonalPricing: [] };
    const total = getTotalPriceForRange(home, "2026-09-01", "2026-09-01");
    expect(total).toBe(0);
  });
});
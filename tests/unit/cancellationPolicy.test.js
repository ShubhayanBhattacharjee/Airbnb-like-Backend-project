import { getRefundPercent } from "../../utils/cancellationPolicy.js";

const NOW = new Date("2026-09-01T00:00:00Z");

describe("getRefundPercent — flexible policy", () => {
  it("gives 100% refund when cancelled 24+ hours before check-in", () => {
    const checkIn = new Date("2026-09-02T01:00:00Z"); // 25h away
    expect(getRefundPercent("flexible", checkIn, NOW)).toBe(100);
  });

  it("gives 0% refund when cancelled within 24 hours of check-in", () => {
    const checkIn = new Date("2026-09-01T12:00:00Z"); // 12h away
    expect(getRefundPercent("flexible", checkIn, NOW)).toBe(0);
  });
});

describe("getRefundPercent — moderate policy", () => {
  it("gives 100% refund 5+ days before check-in", () => {
    const checkIn = new Date("2026-09-06T01:00:00Z"); // 121h away
    expect(getRefundPercent("moderate", checkIn, NOW)).toBe(100);
  });

  it("gives 50% refund between 1 and 5 days before check-in", () => {
    const checkIn = new Date("2026-09-03T00:00:00Z"); // 48h away
    expect(getRefundPercent("moderate", checkIn, NOW)).toBe(50);
  });

  it("gives 0% refund within 24 hours of check-in", () => {
    const checkIn = new Date("2026-09-01T10:00:00Z"); // 10h away
    expect(getRefundPercent("moderate", checkIn, NOW)).toBe(0);
  });

  // Boundary / edge case — exactly on the tier threshold
  it("treats exactly 120 hours before as still qualifying for 100%", () => {
    const checkIn = new Date(NOW.getTime() + 120 * 60 * 60 * 1000);
    expect(getRefundPercent("moderate", checkIn, NOW)).toBe(100);
  });
});

describe("getRefundPercent — strict policy", () => {
  it("gives 50% refund 7+ days before check-in", () => {
    const checkIn = new Date(NOW.getTime() + 169 * 60 * 60 * 1000);
    expect(getRefundPercent("strict", checkIn, NOW)).toBe(50);
  });

  it("gives 0% refund within 7 days of check-in", () => {
    const checkIn = new Date(NOW.getTime() + 100 * 60 * 60 * 1000);
    expect(getRefundPercent("strict", checkIn, NOW)).toBe(0);
  });
});

describe("getRefundPercent — unknown policy", () => {
  it("falls back to the moderate policy if an invalid policy name is passed", () => {
    const checkIn = new Date(NOW.getTime() + 200 * 60 * 60 * 1000);
    expect(getRefundPercent("not-a-real-policy", checkIn, NOW)).toBe(100);
  });
});
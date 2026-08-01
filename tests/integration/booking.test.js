import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret";
process.env.MONGODB_URI = "will-be-overridden";

let mongod;
let app;
let Home;
let Booking;
let User;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  // Import AFTER env vars are set, since app.js reads MONGODB_URI at import time.
  app = (await import("../../app.js")).default;
  Home = (await import("../../models/home.js")).default;
  Booking = (await import("../../models/booking.js")).default;
  User = (await import("../../models/user.js")).default;

  await mongoose.connect(process.env.MONGODB_URI);
}, 20000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Home.deleteMany({});
  await Booking.deleteMany({});
  await User.deleteMany({});
});

async function seedOwnerAndHome(overrides = {}) {
  const owner = await User.create({
    fname: "Test",
    lname: "Host",
    email: `host-${Date.now()}@example.com`,
    password: "hashed-placeholder",
    role: "host",
  });
  const home = await Home.create({
    houseName: "Test Villa",
    price: 2000,
    location: "Goa",
    addressLine1: "123 Beach Rd",
    city: "Goa",
    state: "Goa",
    pincode: "403001",
    country: "India",
    no_of_bedRooms: 2,
    owner: owner._id,
    ...overrides,
  });
  return { owner, home };
}

describe("GET /bookings/check-availability", () => {
  it("returns available:true for a home with no bookings or blocked dates", async () => {
    const { home } = await seedOwnerAndHome();

    const res = await request(app)
      .get("/bookings/check-availability")
      .query({
        homeId: home._id.toString(),
        checkIn: "2026-10-01",
        checkOut: "2026-10-04",
      });

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.nights).toBe(3);
    expect(res.body.totalPrice).toBe(6000); // 3 nights * price 2000
  });

  it("returns available:false when dates overlap a paid, non-cancelled booking", async () => {
    const { home } = await seedOwnerAndHome();
    const guest = await User.create({
      fname: "Test",
      lname: "Guest",
      email: `guest-${Date.now()}@example.com`,
      password: "hashed-placeholder",
    });

    await Booking.create({
      home: home._id,
      guest: guest._id,
      checkIn: new Date("2026-10-10"),
      checkOut: new Date("2026-10-15"),
      guests: 2,
      totalPrice: 10000,
      nights: 5,
      status: "upcoming",
      paymentStatus: "paid",
    });

    const res = await request(app)
      .get("/bookings/check-availability")
      .query({
        homeId: home._id.toString(),
        checkIn: "2026-10-12",
        checkOut: "2026-10-14",
      });

    expect(res.body.available).toBe(false);
  });

  it("returns available:true when the overlapping booking is cancelled", async () => {
    const { home } = await seedOwnerAndHome();
    const guest = await User.create({
      fname: "Test",
      lname: "Guest2",
      email: `guest2-${Date.now()}@example.com`,
      password: "hashed-placeholder",
    });

    await Booking.create({
      home: home._id,
      guest: guest._id,
      checkIn: new Date("2026-11-10"),
      checkOut: new Date("2026-11-15"),
      guests: 2,
      totalPrice: 10000,
      nights: 5,
      status: "cancelled",
      paymentStatus: "paid",
    });

    const res = await request(app)
      .get("/bookings/check-availability")
      .query({
        homeId: home._id.toString(),
        checkIn: "2026-11-12",
        checkOut: "2026-11-14",
      });

    expect(res.body.available).toBe(true);
  });

  it("returns available:false with a message when required query params are missing", async () => {
    const res = await request(app).get("/bookings/check-availability").query({});
    expect(res.body.available).toBe(false);
    expect(res.body.message).toBeTruthy();
  });

  it("returns available:false when checkOut is before or equal to checkIn", async () => {
    const { home } = await seedOwnerAndHome();
    const res = await request(app)
      .get("/bookings/check-availability")
      .query({
        homeId: home._id.toString(),
        checkIn: "2026-10-10",
        checkOut: "2026-10-10",
      });
    expect(res.body.available).toBe(false);
  });
});
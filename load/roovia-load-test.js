import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    ramping: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },   // warm-up
        { duration: "1m",  target: 50 },   // moderate load
        { duration: "1m",  target: 100 },  // heavy load
        { duration: "1m",  target: 150 },  // find the breaking point
        { duration: "30s", target: 0 },    // cool-down
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = "http://localhost:3000";

export default function () {
  const res1 = http.get(`${BASE_URL}/`);
  check(res1, { "homepage 200": (r) => r.status === 200 });

  sleep(1);

  const res2 = http.get(`${BASE_URL}/homeList?search=Goa`);
  check(res2, { "homeList 200": (r) => r.status === 200 });

  sleep(Math.random() * 2);

  const res3 = http.get(
    `${BASE_URL}/bookings/check-availability?homeId=6a6e0163a4a231d1c8c64818&checkIn=2026-10-01&checkOut=2026-10-03`
  );
  check(res3, { "check-availability 200": (r) => r.status === 200 });

  sleep(Math.random() * 2);
}
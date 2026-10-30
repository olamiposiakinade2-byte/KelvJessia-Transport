import { bookingIntakeEnabled, bookingMode, enquiryIntakeEnabled, json, paymentIntakeEnabled } from './_lib.mjs';

export default function handler(_req, res) {
  // This endpoint intentionally exposes operational mode only. It never emits
  // Supabase URLs, keys, user data, or any other server configuration.
  json(res, 200, { mode: bookingMode(), publicBookingApiEnabled: bookingIntakeEnabled(), publicEnquiryApiEnabled: enquiryIntakeEnabled(), paymentApiEnabled: paymentIntakeEnabled() });
}

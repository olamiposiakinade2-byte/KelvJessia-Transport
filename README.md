# KelvJessia Transport

KelvJessia Transport is a static booking-request website. Customers choose a route and departure time, then review and send a prefilled WhatsApp request to the KelvJessia team.

## Booking safeguards

- Every request is marked **Awaiting Confirmation** until the team approves it.
- The customer must tap **Send** in WhatsApp; the website never sends a message automatically.
- Online payments are not collected.
- Customer details are not stored in browser-local booking records.

## Run locally

```bash
npm run preview
```

## API service

`server/` contains the separately deployable Node/SQLite API prepared for Render. The current static site uses WhatsApp handoff until the live API URL is connected to the booking interface.

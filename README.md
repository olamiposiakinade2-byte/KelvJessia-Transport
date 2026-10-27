# KelvJessia Transport

KelvJessia Transport is a static booking-experience demonstration. Customers can explore sample schedules and seats, review a request, and open WhatsApp with a prefilled message for KelvJessia Transport.

## Booking safeguards

- Every request is marked **Awaiting Company Confirmation** until the team approves it.
- The customer must tap **Send** in WhatsApp; the website never sends a message automatically.
- Online payments are not collected.
- Customer details entered in the booking form are not stored in browser-local records. The browser-only dashboard contains fictional sample data only.
- The dashboard is clearly marked **DEMO MODE** and is not secure administrator authentication.

## Run locally

```bash
npm run preview
```

## API service

`server/` contains the separately deployable Node/SQLite API prepared for Render. The current static site uses WhatsApp handoff until the live API URL is connected to the booking interface.

## Vercel deployment

This project is configured as a static deployment with `dist/` as the output directory.

1. Import the GitHub repository into Vercel.
2. Keep the framework preset as **Other**.
3. Leave the build command empty.
4. Confirm the output directory is `dist` (also declared in `vercel.json`).
5. Deploy, then verify the booking flow and `/#admin` dashboard on the generated URL.

The PDF report feature loads jsPDF from jsDelivr in the browser. It needs an internet connection at the moment the report is generated.

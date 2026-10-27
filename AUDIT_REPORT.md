# KelvJessia Transport audit report

Audited: 27 October 2026. Architecture: static HTML, CSS, and browser JavaScript.

## Findings and implemented fixes

| Severity | Finding | Implemented fix |
| --- | --- | --- |
| High | Public flow previously had no review step before WhatsApp handoff. | Added validation and a full booking summary with edit control before the user opens WhatsApp. |
| High | The browser-only admin demo had been removed and could not support the client demonstration. | Restored an explicitly labelled **DEMO MODE** dashboard with fictional records only. |
| High | No reports or filtered exports were available. | Added browser-side filtered PDF and CSV reporting. |
| Medium | Sample availability was not recalculated when sample statuses changed. | Availability now derives from active sample bookings; cancelled samples release simulated seats. |
| Medium | Earlier local storage could contain arbitrary or corrupted values. | Storage is parsed defensively and accepts only valid fictional sample records. Customer form details are never stored. |
| Medium | Navigation did not reflect the requested booking journey. | Updated navigation, homepage calls to action, departure-time selection, and responsive dashboard controls. |
| Low | The static site could not truthfully present centralized booking or secure admin functions. | Added transparent demonstration notices and removed claims of automatic confirmation, payment, secure login, or WhatsApp delivery. |

## Remaining limitations

- WhatsApp opens with a prefilled message, but the customer must tap **Send**.
- Sample bookings are stored only in the current browser and are not shared with WhatsApp, other devices, or staff.
- PDF generation depends on the browser loading the jsPDF CDN scripts.
- The admin dashboard is not authentication; it is for the meeting demonstration only.

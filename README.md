# Challenge Board

Angular 21 standalone, browser-only team quiz competition. No server/database required beyond serving the Angular application.

## Run

Requires Node.js compatible with Angular 21 and npm.

```bash
npm install
npm start
```

Open the local URL shown by Angular CLI (normally http://localhost:4200).

## Features

- Auto update of Version in Package.json using Husky & Git extrension
- Five original subject question banks imported from the supplied classroom quiz: Java, Python, TypeScript, Angular, Spring Boot.
- CRUD question bank editor including category management, clue/response/hint editing, duplicate and delete.
- Import/export portable JSON games; local browser persistence.
- Adjustable team scoring, hints, countdown, final wagers and results export.
- Pop-out projector window (same browser origin, BroadcastChannel synchronization).
- BuzzIn.live opens separately. There is no API integration with BuzzIn.live.
- Each room uses its own browser state; championship uses the same app with a fresh game and four winning teams.

## Operational advice

The instructor should use the host window, with a separate projector window (opened with the Projector button). The instructor must keep the host window open, because synchronization is in-browser and not networked. On a different computer/browser, import the JSON game file. Export results after each qualifier. Browser localStorage is not a backup: export JSON after editing.

## Limitations

- Projector synchronization is best-effort between same-origin browser windows; no multi-device synchronization.
- The original questions are imported largely unchanged and some need editorial review. The editor flags empty and duplicate-value clues.
- The `Bonus` checkbox is reserved for future Daily Double mechanics; it does not currently change wagering.
- The app should be tested with `npm install && npm run build` in a network-enabled environment before classroom use.

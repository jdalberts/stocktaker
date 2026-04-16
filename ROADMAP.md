# StockTaker Roadmap

## In progress
- Warehouse one-handed UX pass — big quantity field, sticky Add, scan-next-pallet flow, undo toast

## Next
- Haptic feedback (`navigator.vibrate`) on successful Add
- Duplicate-lot warning — flash a banner if the scanned lot number is already logged today, to prevent double-counting a pallet
- "Same product — next pallet" shortcut button — skip camera and keep auto-filled fields when multiple pallets share a SKU (just re-enter quantity)

## Done
- Serverless scan proxy with CORS origin allowlist
- Model bumped to `claude-sonnet-4-6`
- Defensive parsing of Anthropic response shape
- Frontend split into `index.html` / `styles.css` / `app.js`
- Brand palette + mobile tap-target sizing (DM Sans, 52–56px targets, thumb-zone nav)

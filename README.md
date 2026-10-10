# Two Hearts, One Cart

A shared grocery list for two. One file, no build step, installable as a
PWA, synced in real time through Firebase Firestore, hosted on GitHub Pages.

## How it works

- **Join a list** with any code (or a generated one). Each list is a Firestore
  document under `groceryLists/{CODE}` with an `items` sub-collection and a
  `presence` sub-collection. Sign-in is anonymous and invisible; the only
  identity is the name you type.
- **List tab** is the active trip: search-or-add, check off while shopping,
  a progress bar, then "move to history". Undo is on the toast.
- **Browse tab** is your catalog: everything ever added plus a starter pack,
  with Favorites (most-purchased) at the top. One tap re-adds.
- **History tab** shows what you bought, most recent first.
- **Store tags** mark items that are *only* available at a given store.
  Untagged items are assumed to be everywhere, so they show under every filter.
- **Barcode scanning** (Open Food Facts) is a bonus: it suggests a short name
  and a product photo. Hit-or-miss by design, so the UI treats a miss as normal.
- **Offline**: Firestore's IndexedDB cache keeps the list readable and
  writable without signal; changes sync when you're back online.
- **Themes**: follows the system, or pin light/dark in Settings.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole app: styles, data layer, state, rendering, sheets. |
| `sw.js` | Service worker. Network-first for the shell, cache-first for pinned CDN libraries, hands-off for Firestore and other APIs. |
| `manifest.json`, `icons/` | PWA install metadata. |

## Developing

Serve the folder with any static server (`python3 -m http.server`) and open
`index.html`. There are no dependencies to install. Because the SW is
network-first and `updateViaCache: "none"`, a deploy is picked up on the next
open with one automatic reload.

Item documents look like:

```
name, nameKey (lowercase), emoji, storeTags[], status: active|done|suggested,
checked, note, noteImage, timesAdded, addedBy (uid), createdAt, lastAddedAt, lastDoneAt
```

Status transitions: `suggested/done → active` (add), `active → done` (move to
history), `active → suggested` (take off list). Notes and photos stay on the
document until the item is *re-added*, which is what makes Undo lossless.

## Ideas not built yet

Roughly in order of value for a two-person household:

1. **Bundles.** Save a set of items as "Taco night" or "Weekly basics" and add
   them all with one tap. Fits as a `bundles` array on the list document and a
   section at the top of Browse.
2. **Nudge your partner.** A one-tap "anything else?" that sends a push
   notification before you check out. Needs Firebase Cloud Messaging and a
   small Cloud Function, the first server-side piece.
3. **Aisle order per store.** Let each store remember the order you checked
   things off, then sort the list that way next time you're there.
4. **Quantities as a first-class field** with +/- steppers, instead of free
   text in the note. The note stays for brand and instructions.
5. **Receipt-free spend tracking.** Optional price per item, remembered from
   last time, so the trip shows a running estimate.
6. **Weekly rhythm.** Show "you usually buy this every ~9 days" on Browse items
   and gently surface what's due, computed from `lastDoneAt` history.
7. **Item swipe gestures.** Swipe right to check, swipe left to take off,
   as an alternative to the circle and the edit sheet.

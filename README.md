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
- **Quantities** are a real field: type "3 lemons" or "lemons x3", or use
  the +/- stepper on the item's panel. Shows as a ×3 badge. Like notes, a
  count resets the next time the item is added.
- **"Anything else?" texts**: two ready-made messages at the two moments
  they're useful. Before the trip, with nothing checked yet, the bottom of
  the list offers "Heading to the store"; once you're checking things off it
  switches to "Heading to checkout" next to the progress bar. The paper-plane
  button opens the same sheet, where both presets are one tap away. Each
  opens Messages with the text ready to send. Once your partner's number is saved
  (either of you can enter either number, in Settings or right in the
  sheet) it opens straight to their conversation. The note also
  appears as a banner at the top of their list the next time the app is open.
  No server, no notification permissions: it's an `sms:` link.
- **Item photos**: in an item's panel, Camera takes a photo, Library picks
  one, and Paste drops in a copied picture (⌘V or long-press Paste works
  too). The list shows a small thumbnail; tapping it opens the photo full
  screen. Photos are resized on the phone and stored inline on the item as a
  JPEG data URL (about 150–450 KB, plus a ~2 KB thumbnail), so no Firebase
  Storage bucket or paid plan is needed. Like notes, a photo is cleared the
  next time the item is added, and photos on items that left the list more
  than a day ago are pruned so they don't ride along in every sync.
- **Offline**: Firestore's IndexedDB cache keeps the list readable and
  writable without signal; changes sync when you're back online.
- **Gestures**: swipe a row right to check it off, left to take it off the
  list (with Undo). Pull any sheet down to dismiss it.
- **Themes**: follows the system, or pin light/dark in Settings.

## Design system

- **Type**: the platform font (SF Pro on iPhone). Body 16, item names 17/600,
  secondary 15, captions 13, sheet titles 20, entry title 28. Inputs never go
  below 16px, which is what stops Safari zooming on focus.
- **Color**: cream `#FBF8F2` surface, coral `#FF5D7A` as the brand tint and
  focus ring, raspberry `#D8365B` for filled controls with white text (4.6:1),
  sage green for checked state, all defined as tokens with a dark set.
- **Mark**: the cart-with-heart in `tools/make-assets.mjs` is the single
  source for the header, entry screen, icons, and launch images.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole app: styles, data layer, state, rendering, sheets. |
| `sw.js` | Service worker. Network-first for the shell, cache-first for pinned CDN libraries, hands-off for Firestore and other APIs. |
| `manifest.json`, `icons/` | PWA install metadata. |
| `tools/make-assets.mjs` | Regenerates every icon and iOS launch image from the vector mark. |

## Developing

Serve the folder with any static server (`python3 -m http.server`) and open
`index.html`. There are no dependencies to install. Because the SW is
network-first and `updateViaCache: "none"`, a deploy is picked up on the next
open with one automatic reload.

Item documents look like:

```
name, nameKey (lowercase), emoji, storeTags[], status: active|done|suggested,
checked, note, noteImage (https URL or data:image/jpeg), noteThumb, timesAdded, addedBy (uid), createdAt, lastAddedAt, lastDoneAt
```

Status transitions: `suggested/done → active` (add), `active → done` (move to
history), `active → suggested` (take off list). Notes and photos stay on the
document until the item is *re-added*, which is what makes Undo lossless.

People entries on the list document are `{uid, name, phone?}`. One person
can have several entries (one per device, since anonymous sign-in is per
browser storage); same-name entries are treated as the same person.

Nudge documents live at `groceryLists/{CODE}/nudges/{id}`:

```
fromUid, fromName, toUids[], message, store, createdAt
```

Clients prune nudges older than 24 hours.

## Ideas not built yet

Roughly in order of value for a two-person household:

1. **Bundles.** Save a set of items as "Taco night" or "Weekly basics" and add
   them all with one tap. Fits as a `bundles` array on the list document and a
   section at the top of Browse.
2. **Aisle order per store.** Let each store remember the order you checked
   things off, then sort the list that way next time you're there.
3. **Receipt-free spend tracking.** Optional price per item, remembered from
   last time, so the trip shows a running estimate.
4. **Weekly rhythm.** Show "you usually buy this every ~9 days" on Browse items
   and gently surface what's due, computed from `lastDoneAt` history.
5. **Shared bundles across lists.** Once bundles exist, let a household keep
   one catalog across several lists (weekly, party, cabin).

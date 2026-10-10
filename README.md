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
- **Nudges** ("anything else?"): the 💌 button, or the link in the bottom bar
  during a trip, sends your partner a short message. It appears as a banner
  in their app immediately, and as a phone notification if they turned those
  on and the Cloud Function below is deployed.
- **Offline**: Firestore's IndexedDB cache keeps the list readable and
  writable without signal; changes sync when you're back online.
- **Themes**: follows the system, or pin light/dark in Settings.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole app: styles, data layer, state, rendering, sheets. |
| `sw.js` | Service worker. Network-first for the shell, cache-first for pinned CDN libraries, hands-off for Firestore and other APIs. |
| `manifest.json`, `icons/` | PWA install metadata. |
| `functions/index.js` | Cloud Function: turns a nudge document into push notifications. |
| `firebase.json`, `.firebaserc` | Firebase CLI config for deploying the function. |

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

Nudge documents live at `groceryLists/{CODE}/nudges/{id}`:

```
fromUid, fromName, toUids[], message, store, link, createdAt,
status (set by the function: sent | failed | no-devices | no-recipients), sentCount, sentAt
```

Device tokens for push live on the user document: `users/{uid}.fcmTokens[]`.
Clients prune nudges older than 24 hours.

## Turning on phone notifications

Nudges work inside the app with no setup. For notifications when the app is
closed, three one-time steps (the Firebase project must be on the Blaze plan
for Cloud Functions; the free quota covers this comfortably):

1. **Web Push key.** Firebase console → Project settings → Cloud Messaging →
   Web configuration → *Generate key pair*. Paste the public key into
   `FCM_VAPID_KEY` near the top of `index.html` and deploy the site.
2. **Deploy the function.**
   ```
   npm install -g firebase-tools
   firebase login
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
3. **Firestore rules.** Make sure signed-in users can write their own user
   doc and create nudges. If your rules are per-collection, add:
   ```
   match /users/{uid} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   match /groceryLists/{code}/nudges/{id} {
     allow read, create, delete: if request.auth != null;
   }
   ```
   (The function runs with admin credentials and is not subject to rules.)

Then each partner taps 💌 → *Turn on notifications* on the device they
carry to the store. On iPhone that only works from the Home Screen version
of the app (iOS 16.4+), which the sheet explains.

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
5. **Item swipe gestures.** Swipe right to check, swipe left to take off,
   as an alternative to the circle and the edit sheet. Needs direction
   locking against vertical scroll, an edge dead-zone so iOS back-swipe
   doesn't fight it, and a hold on re-renders while a finger is down.

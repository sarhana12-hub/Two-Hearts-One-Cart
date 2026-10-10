// Partner nudges -> phone notifications.
//
// The web app writes a small document to groceryLists/{code}/nudges when one
// partner taps "anything else?". This function fans it out to every device
// token the recipients have registered (users/{uid}.fcmTokens), prunes
// tokens that FCM reports as dead, and stamps the nudge as sent. The app
// shows the same nudge as an in-app banner on its own, so this is only the
// "app is closed" path.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
setGlobalOptions({ maxInstances: 5 });

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

exports.sendNudge = onDocumentCreated("groceryLists/{code}/nudges/{nudgeId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const nudge = snap.data() || {};
  const db = getFirestore();

  const recipients = (nudge.toUids || []).filter((uid) => uid && uid !== nudge.fromUid);
  if (!recipients.length) {
    await snap.ref.update({ status: "no-recipients" });
    return;
  }

  // Collect tokens per recipient so dead ones can be removed from the right doc.
  const tokensByUid = {};
  await Promise.all(recipients.map(async (uid) => {
    const user = await db.doc(`users/${uid}`).get();
    tokensByUid[uid] = (user.exists && Array.isArray(user.data().fcmTokens)) ? user.data().fcmTokens : [];
  }));
  const tokens = [...new Set(Object.values(tokensByUid).flat())];
  if (!tokens.length) {
    await snap.ref.update({ status: "no-devices" });
    return;
  }

  const link = typeof nudge.link === "string" && nudge.link.startsWith("https://") ? nudge.link : undefined;
  const fromName = String(nudge.fromName || "Your partner").slice(0, 40);
  const message = String(nudge.message || "Anything else?").slice(0, 200);

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: `💌 ${fromName}`, body: message },
    data: {
      code: String(event.params.code),
      nudgeId: String(event.params.nudgeId),
      message,
      tag: `nudge-${event.params.code}`,
      ...(link ? { link } : {}),
    },
    webpush: {
      headers: { Urgency: "high", TTL: "3600" },
      notification: {
        title: `💌 ${fromName}`,
        body: message,
        icon: link ? `${link}icons/icon-192.png` : undefined,
        tag: `nudge-${event.params.code}`,
        renotify: true,
      },
      ...(link ? { fcmOptions: { link } } : {}),
    },
  });

  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) dead.push(tokens[i]);
  });
  await Promise.all(Object.entries(tokensByUid).map(([uid, list]) => {
    const remove = list.filter((t) => dead.includes(t));
    return remove.length ? db.doc(`users/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...remove) }) : null;
  }));

  await snap.ref.update({
    status: res.successCount > 0 ? "sent" : "failed",
    sentCount: res.successCount,
    failedCount: res.failureCount,
    sentAt: FieldValue.serverTimestamp(),
  });
});

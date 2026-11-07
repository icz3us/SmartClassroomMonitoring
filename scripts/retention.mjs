import { db } from "./admin.mjs";
const device = process.env.NEXT_PUBLIC_DEVICE_ID || "classroom-01";
const days = Number(process.env.RETENTION_DAYS || 30);
if (!Number.isFinite(days) || days < 7)
  throw new Error("RETENTION_DAYS must be at least 7");
const cutoff = Date.now() - days * 86400000;
const apply = process.argv.includes("--apply");
for (const collection of ["readings", "events"]) {
  let total = 0;
  for (;;) {
    const path = db.ref(`${collection}/${device}`);
    const batch = await path
      .orderByChild("timestamp")
      .endAt(cutoff)
      .limitToFirst(500)
      .get();
    if (!batch.exists()) break;
    const removals = {};
    batch.forEach((child) => {
      removals[child.key] = null;
      total++;
    });
    if (!apply) {
      console.log(
        `${collection}: ${total} expired records in first bounded batch (preview). Run with --apply to delete all expired batches.`,
      );
      break;
    }
    await path.update(removals);
  }
  if (apply || total === 0)
    console.log(
      `${collection}: ${total} expired records ${apply ? "deleted" : "found"}.`,
    );
}
process.exit(0);

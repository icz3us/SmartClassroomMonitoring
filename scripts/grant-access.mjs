import { db, auth } from "./admin.mjs";
const [role, email, device = "classroom-01"] = process.argv.slice(2);
if (!["viewer", "device"].includes(role) || !email || /[.#$\[\]/]/.test(device))
  throw new Error(
    "Usage: node scripts/grant-access.mjs viewer|device email classroom-01",
  );
const { uid } = await auth.getUserByEmail(email);
if (role === "viewer")
  await db.ref(`access/viewers/${uid}/${device}`).set(true);
else await db.ref(`access/devices/${uid}`).set(device);
await db
  .ref(`settings/${device}`)
  .set({ warningTemperature: 32, dangerTemperature: 35 });
console.log(
  `Granted ${role} access to ${device} for ${email}. Sign out and back in if necessary.`,
);
process.exit(0);

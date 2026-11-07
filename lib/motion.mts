import {
  endBefore,
  get,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
  type Database,
  type DataSnapshot,
} from "firebase/database";

export function subscribeLastMotion(
  db: Database,
  device: string,
  onTimestamp: (timestamp: number | null) => void,
  onError: (error: Error) => void,
) {
  const events = ref(db, `events/${device}`);
  const constraints = [orderByChild("timestamp"), startAt(0), limitToLast(100)];
  let version = 0;
  const stop = onValue(
    query(events, ...constraints),
    (snapshot) => {
      const request = ++version;
      async function findLatest(page: DataSnapshot): Promise<void> {
        while (request === version) {
          let oldest: DataSnapshot | null = null;
          let latest: number | null = null;
          page.forEach((child) => {
            oldest ??= child;
            const event = child.val();
            if (
              event.type === "motion_started" &&
              Number.isFinite(event.timestamp)
            )
              latest = event.timestamp;
          });
          if (latest !== null || page.size < 100 || !oldest) {
            onTimestamp(latest);
            return;
          }
          const cursor = oldest as DataSnapshot;
          page = await get(
            query(
              events,
              ...constraints,
              endBefore(cursor.child("timestamp").val(), cursor.key!),
            ),
          );
        }
      }
      void findLatest(snapshot).catch((error: Error) => {
        if (request === version) onError(error);
      });
    },
    (error) => {
      version++;
      onError(error);
    },
  );
  return () => {
    version++;
    stop();
  };
}

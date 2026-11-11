#include "../firmware/SmartClassroom/occupancy.h"

constexpr bool startupAndTimeout() {
  OccupancyMonitor state(100);
  if (state.update(false, 100) || state.status != OCCUPANCY_UNKNOWN) return false;
  if (state.update(false, 600099)) return false;
  return state.update(false, 600100) && state.status == OCCUPANCY_INACTIVE;
}

constexpr bool motionExtendsOccupancy() {
  OccupancyMonitor state;
  if (!state.update(true, 1000) || state.status != OCCUPANCY_LIKELY) return false;
  if (state.update(false, 1001) || state.update(true, 500000)) return false;
  if (state.update(false, 1099999)) return false;
  if (!state.update(false, 1100000) || state.status != OCCUPANCY_INACTIVE) return false;
  if (state.update(false, 1100001)) return false;
  return state.update(true, 1100002) && state.status == OCCUPANCY_LIKELY;
}

constexpr bool continuousMotionAndRollover() {
  OccupancyMonitor state(0xfffffff0U);
  if (!state.update(true, 0xfffffff0U)) return false;
  if (state.update(true, 600000U) || state.status != OCCUPANCY_LIKELY) return false;
  if (state.update(false, 1199999U)) return false;
  return state.update(false, 1200000U) && state.status == OCCUPANCY_INACTIVE;
}

static_assert(startupAndTimeout(), "Boot must remain unknown until motion or a full observation window");
static_assert(motionExtendsOccupancy(), "Motion extends occupancy and only state changes generate events");
static_assert(continuousMotionAndRollover(), "Continuous motion and millis rollover must preserve timing");

constexpr bool timeoutAcrossRollover() {
  constexpr uint32_t start = 0xfffffff0U;
  OccupancyMonitor state(start);
  state.update(true, start);
  if (state.update(false, uint32_t(start + OCCUPANCY_TIMEOUT_MS - 1))) return false;
  return state.update(false, uint32_t(start + OCCUPANCY_TIMEOUT_MS)) && state.status == OCCUPANCY_INACTIVE;
}
static_assert(timeoutAcrossRollover(), "A timeout spanning millis rollover must expire at the exact boundary");

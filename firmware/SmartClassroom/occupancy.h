#pragma once
#include <stdint.h>

constexpr uint32_t OCCUPANCY_TIMEOUT_SECONDS = 600;
constexpr uint32_t OCCUPANCY_TIMEOUT_MS = OCCUPANCY_TIMEOUT_SECONDS * 1000UL;
enum OccupancyStatus : uint8_t { OCCUPANCY_UNKNOWN, OCCUPANCY_LIKELY, OCCUPANCY_INACTIVE };

struct OccupancyMonitor {
  uint32_t lastActivity;
  bool detected = false;
  OccupancyStatus status = OCCUPANCY_UNKNOWN;

  constexpr explicit OccupancyMonitor(uint32_t startedAt = 0) : lastActivity(startedAt) {}

  constexpr bool update(bool motion, uint32_t now) {
    if (motion) { lastActivity = now; detected = true; }
    const OccupancyStatus next = uint32_t(now - lastActivity) >= OCCUPANCY_TIMEOUT_MS
      ? OCCUPANCY_INACTIVE : detected ? OCCUPANCY_LIKELY : OCCUPANCY_UNKNOWN;
    const bool changed = next != status;
    status = next;
    return changed;
  }
};

inline const char* occupancyName(uint8_t status) {
  return status == OCCUPANCY_LIKELY ? "likely_occupied"
    : status == OCCUPANCY_INACTIVE ? "no_recent_activity" : "unknown";
}

inline const char* occupancyEventName(uint8_t status) {
  return status == OCCUPANCY_LIKELY ? "occupancy_likely_occupied"
    : status == OCCUPANCY_INACTIVE ? "occupancy_no_recent_activity" : "occupancy_unknown";
}

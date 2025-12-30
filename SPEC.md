# Treadmill Controller Web App Specification

## Overview

A Progressive Web App (PWA) for controlling and monitoring the DBT Walking Pad Under-Desk Treadmill via Web Bluetooth. Designed to run entirely client-side with no backend, deployable on GitHub Pages.

## Target Hardware

- **Device:** DBT Walking Pad Under-Desk Treadmill (Amazon B0CHHKC94J)
- **Controller:** FITSHOW FS-BT-T4
- **Protocol:** Bluetooth Fitness Machine Service (FTMS) specification

## Current State

### Implemented Features
- Bluetooth device discovery and connection
- Real-time data streaming (speed, distance, time, calories)
- Training status tracking (Idle, Pre-Workout, Manual Mode, Post-Workout)
- Unit conversion (km/h → mph, meters → miles)
- Session detection and recording
- IndexedDB persistence via Dexie (treadmill data, training status, sessions)
- Web Worker for non-blocking storage operations

### Known Issues
- Session end handling may be incomplete if no recent data available
- Calorie calculation relies on treadmill's built-in estimate
- Control Point (sending commands) not implemented

---

## Feature Requirements

### Priority 1: Treadmill Control

**Goal:** Send commands to control the treadmill, not just monitor it.

#### Requirements
- [ ] Implement FTMS Control Point characteristic (0x2AD9)
- [ ] Start/Stop workout commands
- [ ] Speed adjustment using +/- buttons
- [ ] Speed range and increments based on device-reported limits
- [ ] Query device for supported speed range via Fitness Machine Feature characteristic
- [ ] Visual feedback when commands are sent/acknowledged
- [ ] Disable controls when disconnected

#### UI
- Start/Stop button (toggle based on current state)
- Speed display with +/- increment buttons
- Current speed prominently displayed
- Target speed indicator (when adjusting)

---

### Priority 2: Session History

**Goal:** View, analyze, and manage past workout sessions.

#### Requirements
- [ ] Session list view showing all completed sessions
- [ ] Session detail view with full metrics
- [ ] Delete individual sessions
- [ ] Bulk delete option
- [ ] Export sessions as CSV
- [ ] Export sessions as JSON

#### Session List Display
- Date/time
- Duration
- Distance
- Average speed
- Calories burned

#### Session Detail View
- All metrics from list view
- Speed over time chart
- Distance progress chart

---

### Priority 3: Charts & Visualization

**Goal:** Visualize workout data with interactive charts.

#### Library
- Apache ECharts (preferred)
- Must work offline (bundle with app)

#### Chart Types
- [ ] **Speed over time:** Line chart showing pace throughout a session
- [ ] **Distance progress:** Cumulative distance during workout
- [ ] **Weekly summary:** Aggregate stats (total distance, time, sessions) by week
- [ ] **Monthly summary:** Aggregate stats by month

#### Requirements
- Charts must render from IndexedDB data
- Responsive sizing for mobile/desktop
- Touch-friendly interactions

---

### Priority 4: Workout Goals

**Goal:** Set targets for workouts and track progress.

#### Requirements
- [ ] Target distance goal (miles)
- [ ] Target duration goal (HH:MM)
- [ ] Progress indicator during workout
- [ ] Audio/visual/haptic alert when goal reached
- [ ] Goals persist across sessions (optional: save as presets)

#### UI
- Goal input before/during workout
- Progress bar or percentage display
- Clear visual indication when goal achieved

---

### Priority 5: User Settings

**Goal:** Personalize the app experience.

#### Settings
- [ ] Body weight (for calorie calculation)
- [ ] Calorie calculation using weight + speed + duration

#### Storage
- Settings stored in IndexedDB
- Applied immediately when changed

---

### Priority 6: PWA & Offline Support

**Goal:** Installable app that works fully offline.

#### Requirements
- [ ] Service Worker for offline caching
- [ ] Web App Manifest for installation
- [ ] All assets cached for offline use
- [ ] Works without internet after initial load
- [ ] "Add to Home Screen" prompt support

#### Deployment
- GitHub Pages compatible (static files only)
- No backend dependencies

---

### Priority 7: Connection Resilience

**Goal:** Handle disconnections gracefully.

#### Requirements
- [ ] Auto-reconnect on unexpected disconnect
- [ ] Reconnection attempts with exponential backoff
- [ ] Visual indicator of connection state (connected/reconnecting/disconnected)
- [ ] Save partial session data if disconnected mid-workout
- [ ] Resume session if reconnected within reasonable time

---

### Priority 8: Feedback & Alerts

**Goal:** Notify users of important events.

#### Alert Types
- [ ] Goal reached (distance/duration)
- [ ] Disconnection warning
- [ ] Reconnection success
- [ ] Session started/ended

#### Feedback Methods
- [ ] Visual alerts (toast notifications, UI indicators)
- [ ] Sound alerts (configurable beeps/tones)
- [ ] Vibration (on supported mobile devices)

---

## Data Management

### Storage Strategy
- Keep all data indefinitely by default
- Monitor IndexedDB quota usage
- If storage quota exceeded, prompt user to export and delete old sessions
- No automatic deletion without user consent

### Data Schema (existing, extend as needed)

```typescript
// treadmillData - raw notification data
{
  timestamp: number,
  speed: number,
  distance: number,
  formattedTime: string,
  elapsedTime: number,
  kcal: number
}

// trainingStatus - status changes
{
  timestamp: number,
  status: string,
  stringFromStatus: string
}

// session - completed workouts
{
  id: number,
  started: number,
  ended: number,
  duration: number,
  distance: number,
  averageSpeed: number,
  energyExpended: number
}

// settings (new)
{
  weightKg: number,
  // future settings here
}
```

---

## UI/UX Guidelines

### Layout
- Keep current minimal single-page layout
- Add new features inline (not separate pages)
- Collapsible sections for history, settings, charts
- Mobile-first responsive design

### Controls
- Large touch targets for treadmill controls
- +/- buttons for speed adjustment
- Clear visual state for Start/Stop

### Theme
- Keep simple, functional aesthetic
- High contrast for readability during workout
- Consider dark mode (future enhancement)

---

## Technical Constraints

### Browser Requirements
- Chrome, Edge, or Chromium-based browser
- Web Bluetooth API support
- IndexedDB support
- Service Worker support

### Build System
- TypeScript + Parcel (existing)
- Bundle ECharts for offline use
- Generate service worker during build

### No Backend
- All data stored client-side
- No server communication
- No user accounts or cloud sync

---

## Implementation Order

1. **Treadmill Control** - Implement Control Point, add speed +/- buttons
2. **Session History** - List view, delete functionality
3. **Export** - CSV and JSON export
4. **Charts** - Add ECharts, implement session charts
5. **Summary Charts** - Weekly/monthly aggregations
6. **Goals** - Distance and duration targets
7. **Settings** - Weight input, calorie calculation
8. **PWA** - Service worker, manifest, offline support
9. **Auto-reconnect** - Connection resilience
10. **Alerts** - Sound, visual, vibration feedback

---

## Testing Notes

- Test with actual DBT Walking Pad hardware
- Test offline functionality by disabling network
- Test PWA installation on mobile Chrome
- Verify IndexedDB persistence across browser restarts
- Test reconnection scenarios (walk out of range, come back)

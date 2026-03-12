Project: "RespawnTok" – Developer Roadmap
1. Executive Summary
Goal: Create a standalone Windows desktop application that detects when a player dies in Counter-Strike 2 or Dota 2 and automatically brings a TikTok feed (with ads) to the foreground.
Tech Stack: Electron.js (Frontend/UI), Node.js (Backend Listener), Valve Game State Integration (GSI).
Constraints: Must not trigger Anti-Cheat (VAC). Must be standalone (no Overwolf).

2. Technical Architecture
Phase 1: The GSI Listener (The "Trigger")
The app must act as a local HTTP server to receive data from the game.

Target: Create a Node.js server using express listening on http://localhost:3000.

CS2 GSI Config: The app must automatically generate and place a .cfg file in:
...\steamapps\common\Counter-Strike 2\game\csgo\cfg\gamestate_integration_respawntok.cfg

Payload Logic:

Monitor the JSON path: player.state.health.

Trigger Condition: If health transitions from >0 to 0.

Reset Condition: If health becomes >0 again (respawn), minimize or hide the TikTok window.

Phase 2: The Electron Frontend (The "Viewer")
Main Window: A frameless, "Always on Top" Electron window.

Webview: Embed https://www.tiktok.com/foryou.

Window Management:

win.show() and win.focus() on death.

win.hide() or win.minimize() on respawn.

Optimization: Implement a "Mute Game" toggle using a system-level volume mixer library so the TikTok audio isn't drowned out by the game.

Phase 3: Monetization & Ad Integration
Ad Strategy: Since we are using Electron, we will use Google AdSense or Carbon Ads.

UI Layout: * The TikTok feed should be in a 9:16 central column.

Left/Right sidebars should be dedicated to display ads or affiliate "Skin Trading" banners.

User Tiers: Implement a local check for a "License Key" (via Stripe) to disable side-panel ads.

3. Critical Implementation Details (For Claude)
GSI Configuration Example
Claude, please generate the logic to write this file to the user's CS2 folder:

JSON

"RespawnTok v1.0" {
 "uri" "http://localhost:3000"
 "timeout" "5.0"
 "buffer"  "0.1"
 "throttle" "0.1"
 "heartbeat" "30.0"
 "data" {
   "player_state" "1"
   "map" "1"
 }
}
The "Focus" Problem
In CS2 Fullscreen mode, the game will minimize when the app grabs focus.

Task: Include a "Setup Guide" inside the app UI that instructs users to use "Fullscreen Windowed" mode.

Task: Implement globalShortcut to allow the user to manually close the TikTok window with a hotkey (e.g., Alt+X) if they respawn early.

4. Development Steps for Claude
Step 1: Write the Node.js GSI server that logs "PLAYER DIED" to the console when health hits 0.

Step 2: Integrate this with an Electron boilerplate.

Step 3: Create the logic to find the Steam path via Windows Registry to install the .cfg file automatically.

Step 4: Design a simple "Dashboard" UI where users can log into TikTok and toggle monetization ads.
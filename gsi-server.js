/**
 * gsi-server.js
 * Express HTTP server that receives CS2 and Dota 2 Game State Integration payloads.
 * Tracks player health/alive transitions and emits events:
 *   'player-died'    – player died in CS2 (health → 0) or Dota 2 (hero.alive → false)
 *   'player-respawn' – player respawned in CS2 (health → >0) or Dota 2 (hero.alive → true)
 */

const express = require('express');
const { EventEmitter } = require('events');

const PORT = 3000;

class GSIServer extends EventEmitter {
  constructor() {
    super();
    this.app = express();
    this.app.use(express.json({ type: '*/*' }));
    this.server = null;

    // Shared dead state; per-game previous-value trackers
    this._isDead = false;
    this._prevCS2Health = null;   // CS2: last known health value
    this._prevDotaAlive = null;   // Dota 2: last known hero.alive value

    this.app.post('/', (req, res) => {
      this._handlePayload(req.body);
      res.sendStatus(200);
    });

    // Heartbeat / health check
    this.app.get('/', (req, res) => res.send('RespawnTok GSI server running'));
  }

  _handlePayload(data) {
    // Only track the local player — ignore spectated teammates
    const mySteamId = String(data?.provider?.steamid ?? '');
    const observedSteamId = String(data?.player?.steamid ?? '');
    if (mySteamId && observedSteamId && mySteamId !== observedSteamId) return;

    const appid = data?.provider?.appid;

    if (appid === 570 || data?.hero !== undefined) {
      this._handleDotaPayload(data);
    } else {
      // CS2 (appid 730) or test-mode CS2 payload
      this._handleCS2Payload(data);
    }
  }

  _handleCS2Payload(data) {
    const health = data?.player?.state?.health;
    if (typeof health !== 'number') return;

    console.log(`[GSI][CS2] health=${health}`);

    const wasAlive = this._prevCS2Health === null || this._prevCS2Health > 0;

    if (wasAlive && health === 0 && !this._isDead) {
      this._isDead = true;
      console.log('[GSI][CS2] PLAYER DIED – showing TikTok');
      this.emit('player-died', data);
    } else if (!wasAlive && health > 0 && this._isDead) {
      this._isDead = false;
      console.log('[GSI][CS2] PLAYER RESPAWNED – hiding TikTok');
      this.emit('player-respawn', data);
    }

    this._prevCS2Health = health;
  }

  _handleDotaPayload(data) {
    const alive = data?.hero?.alive;
    if (typeof alive !== 'boolean') return;

    console.log(`[GSI][Dota2] hero.alive=${alive} respawn_seconds=${data?.hero?.respawn_seconds ?? 'n/a'}`);

    if (!alive && !this._isDead) {
      this._isDead = true;
      console.log('[GSI][Dota2] PLAYER DIED – showing TikTok');
      this.emit('player-died', data);
    } else if (alive && this._isDead) {
      this._isDead = false;
      console.log('[GSI][Dota2] PLAYER RESPAWNED – hiding TikTok');
      this.emit('player-respawn', data);
    }

    this._prevDotaAlive = alive;
  }

  start() {
    this.server = this.app.listen(PORT, '127.0.0.1', () => {
      console.log(`[GSI] Listening on http://localhost:${PORT}`);
    });
    return this;
  }

  stop() {
    if (this.server) this.server.close();
  }
}

module.exports = GSIServer;

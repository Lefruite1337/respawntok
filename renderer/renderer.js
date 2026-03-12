/**
 * renderer.js – Dashboard renderer script
 * Handles tab navigation, GSI install, status updates from main process.
 */

// ─── Tab navigation ───────────────────────────────────────────────────────────
document.querySelectorAll('.sidebar ul li').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar ul li').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');
  });
});

// ─── Install GSI config ───────────────────────────────────────────────────────
async function runInstall(invoker, resultEl, label) {
  const btn = document.getElementById(invoker === 'cs2' ? 'btn-install' : 'btn-install-dota');
  btn.disabled = true;
  btn.textContent = 'Installing…';
  resultEl.classList.add('hidden');

  const result = invoker === 'cs2'
    ? await window.respawnTok.installGSI()
    : await window.respawnTok.installDotaGSI();

  resultEl.textContent = result.message;
  resultEl.classList.remove('hidden', 'success', 'error');
  resultEl.classList.add(result.success ? 'success' : 'error');

  btn.disabled = false;
  btn.textContent = label;
}

document.getElementById('btn-install').addEventListener('click', () =>
  runInstall('cs2', document.getElementById('install-result'), 'Install CS2 GSI Config')
);

document.getElementById('btn-install-dota').addEventListener('click', () =>
  runInstall('dota2', document.getElementById('install-dota-result'), 'Install Dota 2 GSI Config')
);

// ─── Dismiss viewer ───────────────────────────────────────────────────────────
document.getElementById('btn-dismiss').addEventListener('click', () => {
  window.respawnTok.dismissViewer();
  // State update comes back from main via gsi-status IPC — no need to call updatePlayerState here
});

// ─── Live status updates from main process ────────────────────────────────────
const playerStateEl = document.getElementById('player-state');
const viewerStateEl = document.getElementById('viewer-state');

function updatePlayerState(status) {
  playerStateEl.innerHTML = '';
  viewerStateEl.innerHTML = '';

  const dot = document.createElement('span');
  dot.className = 'dot';

  const viewerDot = document.createElement('span');
  viewerDot.className = 'dot';

  switch (status) {
    case 'DEAD':
      dot.classList.add('dot-red');
      playerStateEl.append(dot, ' Dead – TikTok visible');
      viewerDot.classList.add('dot-green');
      viewerStateEl.append(viewerDot, ' Showing');
      break;
    case 'ALIVE':
      dot.classList.add('dot-green');
      playerStateEl.append(dot, ' Alive');
      viewerDot.classList.add('dot-grey');
      viewerStateEl.append(viewerDot, ' Hidden');
      break;
    case 'PAUSED':
      dot.classList.add('dot-yellow');
      playerStateEl.append(dot, ' Paused (Alt+X to resume)');
      viewerDot.classList.add('dot-grey');
      viewerStateEl.append(viewerDot, ' Disabled');
      break;
    case 'MANUAL_CLOSE':
      dot.classList.add('dot-yellow');
      playerStateEl.append(dot, ' Manually closed');
      viewerDot.classList.add('dot-grey');
      viewerStateEl.append(viewerDot, ' Hidden');
      break;
    default:
      dot.classList.add('dot-grey');
      playerStateEl.append(dot, ' Waiting for game…');
      viewerDot.classList.add('dot-grey');
      viewerStateEl.append(viewerDot, ' Hidden');
  }
}

// ─── Auto-updater banner ──────────────────────────────────────────────────────

const updateBanner = document.getElementById('update-banner');
let updateDismissTimer = null;

window.respawnTok.onUpdateStatus((info) => {
  clearTimeout(updateDismissTimer);
  updateBanner.className = 'update-banner';
  updateBanner.innerHTML = '';

  switch (info.state) {
    case 'checking':
      updateBanner.classList.add('update-banner--info');
      updateBanner.textContent = 'Checking for updates…';
      updateDismissTimer = setTimeout(() => updateBanner.classList.add('hidden'), 3000);
      break;

    case 'up-to-date':
      updateBanner.classList.add('update-banner--ok');
      updateBanner.textContent = 'RespawnTok is up to date.';
      updateDismissTimer = setTimeout(() => updateBanner.classList.add('hidden'), 3000);
      break;

    case 'available':
      updateBanner.classList.add('update-banner--info');
      updateBanner.textContent = `Update v${info.version} found — downloading in background…`;
      break;

    case 'downloading':
      updateBanner.classList.add('update-banner--info');
      updateBanner.textContent = `Downloading update… ${info.percent}%`;
      break;

    case 'ready': {
      updateBanner.classList.add('update-banner--ready');
      const msg = document.createElement('span');
      msg.textContent = `v${info.version} ready to install. `;
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'padding:4px 14px;font-size:12px;margin-left:8px';
      btn.textContent = 'Restart & Install';
      btn.addEventListener('click', () => window.respawnTok.installUpdate());
      updateBanner.append(msg, btn);
      break;
    }

    case 'error':
      updateBanner.classList.add('update-banner--error');
      updateBanner.textContent = `Update error: ${info.message}`;
      updateDismissTimer = setTimeout(() => updateBanner.classList.add('hidden'), 6000);
      break;
  }
});

// Hide Test Mode tab in production builds
window.respawnTok.isPackaged().then((packaged) => {
  if (packaged) {
    const testTab = document.querySelector('[data-tab="testmode"]');
    if (testTab) testTab.style.display = 'none';
  }
});

// Initialize
updatePlayerState(null);

// Listen for real-time events from main process
window.respawnTok.onStatusChange(updatePlayerState);

// ─── Test Mode ────────────────────────────────────────────────────────────────

const logEl = document.getElementById('activity-log');
let logEmpty = logEl.querySelector('.log-empty');

function appendLog(entry) {
  if (logEmpty) { logEmpty.remove(); logEmpty = null; }

  const row = document.createElement('div');
  row.className = 'log-entry';

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = entry.time;

  const source = document.createElement('span');
  source.className = `log-source src-${entry.source}`;
  source.textContent = entry.source;

  const msg = document.createElement('span');
  msg.className = 'log-msg';
  msg.textContent = entry.message;

  row.append(time, source, msg);
  logEl.appendChild(row);
  logEl.scrollTop = logEl.scrollHeight;
}

window.respawnTok.onLog(appendLog);

function selectedGame() {
  return document.querySelector('input[name="sim-game"]:checked')?.value ?? 'cs2';
}

async function sendSim(health) {
  const game = selectedGame();
  const result = await window.respawnTok.simulateGSI(health, game);
  if (!result.ok) appendLog({ time: new Date().toLocaleTimeString(), source: 'ERR', message: result.error });
}

document.getElementById('btn-sim-die').addEventListener('click', () => sendSim(0));
document.getElementById('btn-sim-respawn').addEventListener('click', () => sendSim(100));
document.getElementById('btn-sim-lowHP').addEventListener('click', () => sendSim(15));

document.getElementById('btn-sim-custom').addEventListener('click', () => {
  const val = parseInt(document.getElementById('sim-health-input').value, 10);
  if (isNaN(val)) return;
  sendSim(val);
});

document.getElementById('btn-clear-log').addEventListener('click', () => {
  logEl.innerHTML = '<div class="log-empty">No events yet. Simulate an action or start a game.</div>';
  logEmpty = logEl.querySelector('.log-empty');
});

// ─── Settings (stub – persisted in future via electron-store) ─────────────────
document.getElementById('btn-activate').addEventListener('click', () => {
  const key = document.getElementById('license-key').value.trim();
  const result = document.getElementById('license-result');
  result.classList.remove('hidden', 'success', 'error');

  // PoC: accept any 19-char key matching XXXX-XXXX-XXXX-XXXX
  const valid = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key);
  if (valid) {
    result.textContent = 'License activated! Ads disabled.';
    result.classList.add('success');
    document.getElementById('chk-ads').checked = false;
  } else {
    result.textContent = 'Invalid key format. Expected XXXX-XXXX-XXXX-XXXX.';
    result.classList.add('error');
  }
});

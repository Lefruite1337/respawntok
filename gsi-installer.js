/**
 * gsi-installer.js
 * Finds the CS2 installation via the Windows Registry and writes the
 * Game State Integration config file so CS2 reports game state to us.
 *
 * Strategy:
 *  1. Query HKCU\Software\Valve\Steam → InstallPath via `reg query`
 *  2. Fall back to common default paths
 *  3. Locate the CS2 cfg directory and write the .cfg file
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CS2_CFG_CONTENT = `"RespawnTok v1.0"
{
  "uri"       "http://localhost:3000"
  "timeout"   "5.0"
  "buffer"    "0.1"
  "throttle"  "0.1"
  "heartbeat" "30.0"
  "data"
  {
    "provider"     "1"
    "player_state" "1"
    "player_id"    "1"
    "map"          "1"
  }
}
`;

const DOTA2_CFG_CONTENT = `"RespawnTok v1.0"
{
  "uri"       "http://localhost:3000"
  "timeout"   "5.0"
  "buffer"    "0.1"
  "throttle"  "0.1"
  "heartbeat" "30.0"
  "data"
  {
    "provider" "1"
    "map"      "1"
    "player"   "1"
    "hero"     "1"
  }
}
`;

const CFG_FILENAME = 'gamestate_integration_respawntok.cfg';

/**
 * Returns the Steam installation directory or null if not found.
 */
function findSteamPath() {
  // 1. Try Windows Registry (only works on Windows)
  if (process.platform === 'win32') {
    const registryKeys = [
      'HKCU\\Software\\Valve\\Steam',
      'HKLM\\Software\\Valve\\Steam',
      'HKLM\\Software\\Wow6432Node\\Valve\\Steam',
    ];

    for (const key of registryKeys) {
      try {
        const output = execSync(`reg query "${key}" /v InstallPath`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/i);
        if (match) {
          const steamPath = match[1].trim();
          if (fs.existsSync(steamPath)) {
            console.log(`[Installer] Steam found via registry: ${steamPath}`);
            return steamPath;
          }
        }
      } catch {
        // key not present, try next
      }
    }
  }

  // 2. Common default paths
  const defaults = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    process.env.STEAM_DIR || '',           // allow env override
  ].filter(Boolean);

  for (const p of defaults) {
    if (fs.existsSync(p)) {
      console.log(`[Installer] Steam found at default path: ${p}`);
      return p;
    }
  }

  return null;
}

/**
 * Returns the CS2 cfg directory path or null if not found.
 */
function findCS2CfgDir(steamPath) {
  // CS2 is typically in the default libraryfolders, but may be on another drive.
  // For PoC: check the main Steam library only.
  const cfgDir = path.join(
    steamPath,
    'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'
  );

  // CS2 renamed the folder internally; handle both
  const cfgDirCS2 = path.join(
    steamPath,
    'steamapps', 'common', 'Counter-Strike 2', 'game', 'csgo', 'cfg'
  );

  if (fs.existsSync(cfgDirCS2)) return cfgDirCS2;
  if (fs.existsSync(cfgDir)) return cfgDir;
  return null;
}

/**
 * Main installer function.
 * Returns { success: boolean, message: string, cfgPath?: string }
 */
function installGSIConfig() {
  const steamPath = findSteamPath();
  if (!steamPath) {
    return {
      success: false,
      message: 'Steam installation not found. Please set STEAM_DIR environment variable or install Steam.',
    };
  }

  const cfgDir = findCS2CfgDir(steamPath);
  if (!cfgDir) {
    return {
      success: false,
      message: `CS2 cfg directory not found under ${steamPath}. Make sure CS2 is installed.`,
    };
  }

  const cfgPath = path.join(cfgDir, CFG_FILENAME);

  try {
    fs.writeFileSync(cfgPath, CS2_CFG_CONTENT, 'utf8');
    console.log(`[Installer] CS2 GSI config written to: ${cfgPath}`);
    return { success: true, message: `Config installed at:\n${cfgPath}`, cfgPath };
  } catch (err) {
    return { success: false, message: `Failed to write config: ${err.message}` };
  }
}

/**
 * Returns the Dota 2 GSI directory path or null if not found.
 * Dota 2 requires configs inside a 'gamestate_integration' subfolder.
 */
function findDota2CfgDir(steamPath) {
  const candidates = [
    path.join(steamPath, 'steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg', 'gamestate_integration'),
    path.join(steamPath, 'steamapps', 'common', 'Dota 2 Beta',  'game', 'dota', 'cfg', 'gamestate_integration'),
  ];

  for (const dir of candidates) {
    // The gamestate_integration folder may not exist yet — check parent cfg dir
    const parentExists = fs.existsSync(path.dirname(dir));
    if (parentExists) return dir; // we'll create the subfolder if needed
  }
  return null;
}

/**
 * Installs the GSI config for Dota 2.
 * Returns { success: boolean, message: string, cfgPath?: string }
 */
function installDotaGSIConfig() {
  const steamPath = findSteamPath();
  if (!steamPath) {
    return {
      success: false,
      message: 'Steam installation not found. Please set STEAM_DIR environment variable or install Steam.',
    };
  }

  const cfgDir = findDota2CfgDir(steamPath);
  if (!cfgDir) {
    return {
      success: false,
      message: `Dota 2 cfg directory not found under ${steamPath}. Make sure Dota 2 is installed.`,
    };
  }

  try {
    fs.mkdirSync(cfgDir, { recursive: true });
    const cfgPath = path.join(cfgDir, CFG_FILENAME);
    fs.writeFileSync(cfgPath, DOTA2_CFG_CONTENT, 'utf8');
    console.log(`[Installer] Dota 2 GSI config written to: ${cfgPath}`);
    return { success: true, message: `Config installed at:\n${cfgPath}`, cfgPath };
  } catch (err) {
    return { success: false, message: `Failed to write config: ${err.message}` };
  }
}

module.exports = { installGSIConfig, installDotaGSIConfig, findSteamPath };

// Allow running directly: node gsi-installer.js
if (require.main === module) {
  const result = installGSIConfig();
  console.log(result.success ? '✓ ' : '✗ ', result.message);
  process.exit(result.success ? 0 : 1);
}

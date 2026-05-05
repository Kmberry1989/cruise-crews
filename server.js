import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3001;

const rooms = new Map();

const MISSION_STAGES = [
  {
    id: "emergency-drift",
    title: "Emergency Drift",
    brief: "The boat is drifting. Restore navigation and engine power before the route slips away.",
    captain: "Decode one radio/navigation task so the crew knows where to steer.",
    engineer: "Complete one repair task to stabilize power and hull systems.",
    rewardTitle: "Emergency Startup",
    rewardBody: "When the cockpit goes strange, trust the red lights first. Reset warnings, then compare the blank gauges only after systems stabilize.",
    clue: "First clue: red lights point toward the next safe route.",
  },
  {
    id: "manual-builder",
    title: "Build the Owner's Manual",
    brief: "The manual is assembling itself page by page. Finish both stations to reveal the next operating rule.",
    captain: "Solve a word task to recover a missing manual heading.",
    engineer: "Finish a maintenance task to unlock the matching diagram.",
    rewardTitle: "Navigation Glossary",
    rewardBody: "Radio words become manual headings. Maintenance icons become diagrams. Together, they tell the crew what the boat can do next.",
    clue: "Treasure clue: look for the marked grid square when the map appears.",
    event: "treasure-hunt",
  },
  {
    id: "treasure-signal",
    title: "Treasure Signal",
    brief: "A treasure frequency is coming through. Keep talking: one player reads the clue, the other confirms the cockpit grid.",
    captain: "Complete the next communications task to lock the treasure phrase.",
    engineer: "Complete the next repair task to keep the signal from fading.",
    rewardTitle: "Treasure Protocol",
    rewardBody: "The map reader should speak slowly. The cockpit reader confirms row, column, and warning icons before the crew commits.",
    clue: "Demo coordinate: X marks B4. Avoid the reef at C3.",
    event: "treasure-hunt",
  },
  {
    id: "pirate-warning",
    title: "Pirate Warning",
    brief: "Pirate flags are on the horizon. Finish both stations to unlock the first defense drill.",
    captain: "Call out the radio warning phrase before the pirate timer fills.",
    engineer: "Complete a fast maintenance task to arm the playful defense system.",
    rewardTitle: "Pirate Defense Basics",
    rewardBody: "Defense rounds should stay silly and quick: match symbols, sort cannon colors, repair sails, and call out radio warnings.",
    clue: "Next build: timed pirate mini-games with shared callouts.",
    event: "pirate-approach",
  },
];

const EVENTS = {
  "treasure-hunt": {
    id: "treasure-hunt",
    title: "Treasure Hunt Unlocked",
    subtitle: "Launch a true co-op map round: Captain reads the clue, Engineer taps the cockpit GPS coordinate.",
    icon: "🗺️",
  },
  "pirate-approach": {
    id: "pirate-approach",
    title: "Pirates on the Horizon",
    subtitle: "Defend the boat with fast matching, sorting, repair, and radio callouts.",
    icon: "☠️",
  },
  "fog-bank": {
    id: "fog-bank",
    title: "Fog Bank Drift",
    subtitle: "Use the radio and GPS grid together before the route disappears.",
    icon: "🧭",
  },
};

const TREASURE_ROUNDS = [
  {
    id: "berry-cove",
    title: "Berry Cove Cache",
    target: "B4",
    hazards: ["C3", "D2"],
    clue: "From the palm tree, sail two squares east, then one square south. Stop before the reef marker. Call out B4 when you are sure.",
    mapNote: "Palm tree starts at A3. Reef warning: C3. Whirlpool warning: D2.",
    reward: "A small berry-stamped key and 18 gold coins spill into the ship inventory.",
  },
  {
    id: "pearl-bank",
    title: "Pearl Bank Marker",
    target: "D2",
    hazards: ["B2", "E4"],
    clue: "Find the pearl bank on row 2. Count four columns from the left edge. Do not choose the shark shadow at B2.",
    mapNote: "Pearl bank crosses row 2. Shark shadow at B2. Storm pocket at E4.",
    reward: "A pearl compass lens unlocks for the owner’s manual treasure chapter.",
  },
  {
    id: "skull-sandbar",
    title: "Skull Sandbar Detour",
    target: "C5",
    hazards: ["C4", "A5"],
    clue: "Follow the bottom current to row 5. The safe X is centered on the map. Avoid the skull sandbar directly above it.",
    mapNote: "Safe row: 5. Center column: C. Skull sandbar at C4. Jagged rocks at A5.",
    reward: "A glossy ruby anchor charm is added to the treasure shelf.",
  },
];


const COSMETIC_UNLOCKS = [
  { manualPage: 0, category: "steeringWheels", id: "wheel-classic", name: "Classic Toy Wheel" },
  { manualPage: 0, category: "seats", id: "seat-navy", name: "Navy Captain Chair" },
  { manualPage: 1, category: "steeringWheels", id: "wheel-brass", name: "Royal Brass Wheel" },
  { manualPage: 2, category: "seats", id: "seat-cream", name: "Cloud Cream Chair" },
  { manualPage: 3, category: "steeringWheels", id: "wheel-pirate", name: "Pirate Bone Wheel" },
  { manualPage: 4, category: "seats", id: "seat-pirate", name: "Pirate Red Chair" },
  { manualPage: 5, category: "boats", id: "boat-pirate-brown", name: "Brown Pirate Ship" },
  { manualPage: 6, category: "islands", id: "island-berry-cove", name: "Berry Cove Island" },
];

function makeCosmeticState() {
  return {
    unlocked: {
      steeringWheels: ["wheel-classic"],
      seats: ["seat-navy"],
      playerModels: ["player-default"],
      boats: ["boat-glossy-sloop"],
      pirates: [],
      islands: [],
      environments: ["env-sky-cockpit"],
      gui: ["coin", "pearl", "gem", "berry", "pirateFlag", "radioWave"],
    },
    equipped: {
      steeringWheel: "wheel-classic",
      captainSeat: "seat-navy",
      engineerSeat: "seat-navy",
      playerModel: "player-default",
      boat: "boat-glossy-sloop",
      environment: "env-sky-cockpit",
    },
    recentlyUnlocked: [],
  };
}

function unlockCosmeticsForPage(room, pageNumber) {
  const unlockedNow = [];
  for (const unlock of COSMETIC_UNLOCKS.filter((item) => item.manualPage === pageNumber)) {
    const bucket = room.cosmetics.unlocked[unlock.category];
    if (bucket && !bucket.includes(unlock.id)) {
      bucket.push(unlock.id);
      unlockedNow.push(unlock);
    }
  }
  room.cosmetics.recentlyUnlocked = unlockedNow;
  return unlockedNow;
}

const SWITCHES = [
  "nav", "radio", "pump", "fuel", "lights", "gps", "manual", "defense", "aux-a", "aux-b", "aux-c", "aux-d",
].map((id, index) => ({ id, name: "", on: index % 3 !== 0, alert: index < 8 }));

const CAPTAIN_TASKS = [
  { id: "radio-check", role: "captain", type: "word-search", title: "Decode Radio Call", target: "RADIO", hint: "Tap the letters R-A-D-I-O in order. Say the word aloud when it completes.", step: "Find the hidden comms word and confirm it with your partner." },
  { id: "signal-flag", role: "captain", type: "word-search", title: "Signal Flag Scan", target: "ANCHOR", hint: "Trace A-N-C-H-O-R to recover the safe harbor signal.", step: "Read the target word, then tap each letter in order." },
  { id: "plot-course", role: "captain", type: "letter-bank", title: "Build Navigation Term", target: "COMPASS", letters: "ASCOMPS", hint: "Use all letters to build the missing manual heading: COMPASS.", step: "Tap letters in the correct order to assemble the heading." },
  { id: "storm-phrase", role: "captain", type: "letter-bank", title: "Repair Radio Phrase", target: "MAYDAY", letters: "YDAMAY", hint: "Assemble the emergency radio call.", step: "Build the phrase and tell the engineer the warning is clear." },
  { id: "treasure-term", role: "captain", type: "letter-bank", title: "Treasure Clue Phrase", target: "BERRY", letters: "RYEBR", hint: "Build the hidden clue word.", step: "Assemble the clue word to add it to the owner's manual." },
];

const ENGINEER_TASKS = [
  { id: "coolant-sort", role: "engineer", type: "liquid-sort", title: "Balance Coolant Tubes", hint: "Move matching liquid colors into clean tubes.", step: "Tap a tube to pick up the top liquid, then tap a valid tube to pour it." },
  { id: "wire-route", role: "engineer", type: "connect-dots", title: "Reconnect Circuit", hint: "Tap dots 1 through 5 to restore the maintenance circuit.", step: "Follow the numbered route without skipping a dot." },
  { id: "part-match", role: "engineer", type: "matching", title: "Match Spare Parts", hint: "Find all matching boat system icons.", step: "Flip two cards at a time and pair every icon." },
  { id: "fuel-sort", role: "engineer", type: "liquid-sort", title: "Separate Fuel Additives", hint: "Sort the fluids before the engine clogs.", step: "Use the empty tube as your workspace." },
  { id: "valve-route", role: "engineer", type: "connect-dots", title: "Trace Bilge Valve Path", hint: "Tap each numbered valve in order.", step: "The circuit glows as you trace the correct route." },
];

function cleanName(name, fallback = "Crewmate") {
  return String(name || fallback).trim().slice(0, 18) || fallback;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function makeLog(text) {
  return { id: crypto.randomUUID(), at: Date.now(), text };
}

function addLog(room, text) {
  room.log.unshift(makeLog(text));
  room.log = room.log.slice(0, 10);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pickTask(role, completed = []) {
  const deck = role === "captain" ? CAPTAIN_TASKS : ENGINEER_TASKS;
  const options = deck.filter((task) => !completed.includes(task.id));
  const pool = options.length ? options : deck;
  return { ...pool[Math.floor(Math.random() * pool.length)], nonce: crypto.randomUUID() };
}

function newPlayer(name, seat = null) {
  return { id: crypto.randomUUID(), name: cleanName(name), seat, score: 0, connectedAt: Date.now() };
}

function makeRoom(name) {
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  const host = newPlayer(name || "Captain", "captain");
  const room = {
    code,
    createdAt: Date.now(),
    clients: new Map(),
    players: { [host.id]: host },
    seats: { captain: host.id, engineer: null },
    mission: {
      started: false,
      index: 0,
      checklist: { captain: false, engineer: false },
      completedStages: [],
      startedAt: null,
    },
    stats: { hull: 82, power: 70, morale: 76, manualPages: 0, progress: 0, treasure: 0, piratePressure: 0 },
    gauges: { left: 44, center: 62, right: 38 },
    switches: SWITCHES.map((item) => ({ ...item })),
    completed: { captain: [], engineer: [] },
    tasks: { captain: pickTask("captain"), engineer: pickTask("engineer") },
    event: null,
    treasureHunt: null,
    cosmetics: makeCosmeticState(),
    reveal: null,
    lastSuccess: null,
    log: [makeLog("Room created. Claim seats, then start the voyage.")],
  };
  rooms.set(code, room);
  return { room, playerId: host.id };
}

function joinExistingRoom(code, name) {
  const room = rooms.get(String(code || "").trim().toUpperCase());
  if (!room) return null;
  const seat = room.seats.engineer ? (room.seats.captain ? null : "captain") : "engineer";
  const player = newPlayer(name || "Crewmate", seat);
  room.players[player.id] = player;
  if (seat) room.seats[seat] = player.id;
  addLog(room, `${player.name} joined${seat ? ` as ${seat}` : " as observer"}.`);
  return { room, playerId: player.id };
}

function currentStage(room) {
  return MISSION_STAGES[Math.min(room.mission.index, MISSION_STAGES.length - 1)];
}

function startMission(room) {
  room.mission.started = true;
  room.mission.index = 0;
  room.mission.startedAt = Date.now();
  room.mission.checklist = { captain: false, engineer: false };
  room.reveal = null;
  room.event = null;
  addLog(room, `Voyage started: ${currentStage(room).title}.`);
}

function advanceMissionIfReady(room) {
  if (!room.mission.started) return;
  const { captain, engineer } = room.mission.checklist;
  if (!captain || !engineer) return;

  const stage = currentStage(room);
  room.mission.completedStages.push(stage.id);
  room.stats.progress = clamp(room.stats.progress + 15);
  room.stats.manualPages += 1;
  room.stats.treasure = clamp(room.stats.treasure + 10);
  room.stats.morale = clamp(room.stats.morale + 7);

  const cosmeticUnlocks = unlockCosmeticsForPage(room, room.stats.manualPages);

  room.reveal = {
    id: crypto.randomUUID(),
    type: "manual",
    pageNumber: room.stats.manualPages,
    title: stage.rewardTitle,
    body: stage.rewardBody,
    clue: stage.clue,
    unlocks: cosmeticUnlocks,
  };

  room.lastSuccess = {
    id: crypto.randomUUID(),
    at: Date.now(),
    text: `Manual page ${room.stats.manualPages} unlocked: ${stage.rewardTitle}`,
  };

  addLog(room, `Stage cleared: ${stage.title}. Manual page ${room.stats.manualPages} unlocked.`);

  if (stage.event) {
    room.event = { ...EVENTS[stage.event], startedAt: Date.now() };
    addLog(room, `${room.event.title}: ${room.event.subtitle}`);
  }

  room.mission.index = Math.min(room.mission.index + 1, MISSION_STAGES.length - 1);
  room.mission.checklist = { captain: false, engineer: false };
}

function startTreasureHunt(room) {
  const round = TREASURE_ROUNDS[(room.stats.manualPages + room.mission.completedStages.length) % TREASURE_ROUNDS.length];
  room.treasureHunt = {
    ...round,
    active: true,
    solved: false,
    failed: false,
    attempts: 0,
    maxAttempts: 3,
    guesses: [],
    startedAt: Date.now(),
  };
  room.event = null;
  room.reveal = null;
  room.lastSuccess = { id: crypto.randomUUID(), at: Date.now(), text: `Treasure hunt started: ${round.title}` };
  addLog(room, `${round.title} started. Captain reads the clue; Engineer taps the GPS grid.`);
}

function resolveTreasureGuess(room, playerId, coordinate) {
  const player = room.players[playerId];
  const hunt = room.treasureHunt;
  if (!player || !hunt?.active) return { ok: false, error: "No active treasure hunt." };
  if (hunt.solved || hunt.failed) return { ok: true };

  const guess = String(coordinate || "").trim().toUpperCase();
  const correct = guess === hunt.target;
  const hazard = hunt.hazards.includes(guess);
  hunt.attempts += 1;
  hunt.guesses.push({ id: crypto.randomUUID(), coordinate: guess, correct, hazard, player: player.name, at: Date.now() });

  if (correct) {
    hunt.solved = true;
    room.stats.treasure = clamp(room.stats.treasure + 28);
    room.stats.morale = clamp(room.stats.morale + 12);
    room.stats.progress = clamp(room.stats.progress + 12);
    room.reveal = {
      id: crypto.randomUUID(),
      type: "treasure",
      pageNumber: room.stats.manualPages + 1,
      title: `Treasure Found: ${hunt.title}`,
      body: hunt.reward,
      clue: "The crew completed a real co-op communication round.",
    };
    room.lastSuccess = { id: crypto.randomUUID(), at: Date.now(), text: `${player.name} found the treasure at ${guess}.` };
    addLog(room, `${player.name} tapped ${guess}. Treasure found: ${hunt.reward}`);
    return { ok: true };
  }

  room.stats.power = clamp(room.stats.power - (hazard ? 10 : 5));
  room.stats.hull = clamp(room.stats.hull - (hazard ? 8 : 3));
  room.stats.piratePressure = clamp(room.stats.piratePressure + (hazard ? 8 : 3));
  room.lastSuccess = {
    id: crypto.randomUUID(),
    at: Date.now(),
    text: hazard ? `${guess} hit a hazard. Re-read the clue.` : `${guess} was not the X. Try again.`,
  };
  addLog(room, `${player.name} tapped ${guess}. ${hazard ? "Hazard triggered" : "No treasure there"}.`);

  if (hunt.attempts >= hunt.maxAttempts) {
    hunt.failed = true;
    addLog(room, `Treasure signal lost after ${hunt.attempts} guesses. Relaunch the hunt to try a new map.`);
  }

  return { ok: true };
}

function clearTreasureHunt(room) {
  room.treasureHunt = null;
  room.event = null;
  addLog(room, "Treasure hunt closed. Back to the cockpit mission.");
}

function publicRoom(room) {
  const { clients, ...safe } = room;
  return { ...safe, currentStage: currentStage(room), missionStages: MISSION_STAGES.map(({ id, title }) => ({ id, title })) };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    Connection: "close",
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function broadcast(room) {
  const payload = `data: ${JSON.stringify(publicRoom(room))}\n\n`;
  for (const [clientId, res] of room.clients.entries()) {
    try {
      res.write(payload);
    } catch {
      room.clients.delete(clientId);
    }
  }
}

function completeTask(room, playerId, role, result = {}) {
  const player = room.players[playerId];
  const task = room.tasks[role];
  if (!player || !task) return { ok: false, error: "Task unavailable." };

  player.score += 1;
  room.completed[role].push(task.id);
  room.mission.checklist[role] = true;
  room.stats.power = clamp(room.stats.power + (role === "engineer" ? 10 : 4));
  room.stats.hull = clamp(room.stats.hull + (role === "engineer" ? 7 : 3));
  room.stats.morale = clamp(room.stats.morale + (role === "captain" ? 9 : 4));
  room.stats.progress = clamp(room.stats.progress + 5);
  room.stats.piratePressure = clamp(room.stats.piratePressure - 8);
  room.gauges.left = clamp(room.gauges.left + Math.floor(Math.random() * 15) - 5, 5, 95);
  room.gauges.center = clamp(room.gauges.center + Math.floor(Math.random() * 15) - 5, 5, 95);
  room.gauges.right = clamp(room.gauges.right + Math.floor(Math.random() * 15) - 5, 5, 95);

  const alertIndex = room.switches.findIndex((item) => item.alert && !item.on);
  if (alertIndex >= 0) {
    room.switches[alertIndex].on = true;
    room.switches[alertIndex].alert = false;
  }

  room.lastSuccess = {
    id: crypto.randomUUID(),
    at: Date.now(),
    text: `${player.name} completed ${task.title}.`,
  };

  const note = result.note ? `: ${result.note}` : "";
  addLog(room, `${player.name} completed ${task.title}${note}.`);
  room.tasks[role] = pickTask(role, room.completed[role]);
  advanceMissionIfReady(room);
  return { ok: true };
}

function equipCosmetic(room, player, payload = {}) {
  const category = String(payload.category || "");
  const id = String(payload.id || "");
  const target = String(payload.target || "");
  const allowedCategories = ["steeringWheels", "seats", "playerModels", "boats", "islands", "environments"];
  if (!allowedCategories.includes(category)) return { ok: false, error: "Unknown cosmetic category." };
  if (!room.cosmetics.unlocked[category]?.includes(id)) return { ok: false, error: "That cosmetic is still locked." };

  if (category === "steeringWheels") room.cosmetics.equipped.steeringWheel = id;
  if (category === "seats") {
    if (target === "engineer") room.cosmetics.equipped.engineerSeat = id;
    else room.cosmetics.equipped.captainSeat = id;
  }
  if (category === "playerModels") room.cosmetics.equipped.playerModel = id;
  if (category === "boats") room.cosmetics.equipped.boat = id;
  if (category === "environments") room.cosmetics.equipped.environment = id;

  room.lastSuccess = { id: crypto.randomUUID(), at: Date.now(), text: `${player.name} equipped ${id}.` };
  addLog(room, `${player.name} equipped ${id}.`);
  return { ok: true };
}

function handleAction(room, playerId, type, payload = {}) {
  const player = room.players[playerId];
  if (!["event:clear", "reveal:clear", "treasure:clear"].includes(type) && !player) return { ok: false, error: "Player not found." };

  if (type === "mission:start") {
    startMission(room);
    return { ok: true };
  }

  if (type === "seat:claim") {
    const seat = payload.seat;
    if (!["captain", "engineer"].includes(seat)) return { ok: false, error: "Unknown seat." };
    const oldSeat = player.seat;
    const displacedId = room.seats[seat];
    if (oldSeat === seat) return { ok: true };
    if (oldSeat) room.seats[oldSeat] = null;
    if (displacedId && room.players[displacedId]) {
      room.players[displacedId].seat = oldSeat;
      if (oldSeat) room.seats[oldSeat] = displacedId;
    }
    player.seat = seat;
    room.seats[seat] = player.id;
    addLog(room, `${player.name} moved to the ${seat} seat.`);
    return { ok: true };
  }

  if (type === "seat:swap") {
    const captain = room.seats.captain;
    const engineer = room.seats.engineer;
    room.seats.captain = engineer;
    room.seats.engineer = captain;
    if (captain && room.players[captain]) room.players[captain].seat = "engineer";
    if (engineer && room.players[engineer]) room.players[engineer].seat = "captain";
    addLog(room, "The crew swapped seats and exchanged cockpit responsibilities.");
    return { ok: true };
  }

  if (type === "switch:toggle") {
    const item = room.switches.find((switchItem) => switchItem.id === payload.id);
    if (!item) return { ok: false, error: "Switch not found." };
    item.on = !item.on;
    item.alert = !item.on;
    room.stats.power = clamp(room.stats.power + (item.on ? 3 : -4));
    room.lastSuccess = { id: crypto.randomUUID(), at: Date.now(), text: `Breaker ${item.on ? "restored" : "tripped"}.` };
    addLog(room, `${player.name} toggled a cockpit breaker ${item.on ? "on" : "off"}.`);
    return { ok: true };
  }

  if (type === "cosmetic:equip") return equipCosmetic(room, player, payload);

  if (type === "task:complete") return completeTask(room, playerId, payload.role, payload.result);

  if (type === "treasure:start") {
    startTreasureHunt(room);
    return { ok: true };
  }

  if (type === "treasure:guess") {
    return resolveTreasureGuess(room, playerId, payload.coordinate);
  }

  if (type === "treasure:clear") {
    clearTreasureHunt(room);
    return { ok: true };
  }

  if (type === "event:trigger") {
    const event = EVENTS[payload.id] || EVENTS["treasure-hunt"];
    room.event = { ...event, startedAt: Date.now() };
    addLog(room, `${event.title}: ${event.subtitle}`);
    return { ok: true };
  }

  if (type === "event:clear") {
    room.event = null;
    addLog(room, "Event acknowledged. Back to the cockpit.");
    return { ok: true };
  }

  if (type === "reveal:clear") {
    room.reveal = null;
    return { ok: true };
  }

  return { ok: false, error: "Unknown action." };
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true, version: "0.4.0" });

    if (req.method === "POST" && url.pathname === "/api/create") {
      const body = await readJson(req);
      const { room, playerId } = makeRoom(body.name);
      broadcast(room);
      return sendJson(res, 200, { ok: true, code: room.code, playerId, room: publicRoom(room) });
    }

    if (req.method === "POST" && url.pathname === "/api/join") {
      const body = await readJson(req);
      const result = joinExistingRoom(body.code, body.name);
      if (!result) return sendJson(res, 404, { ok: false, error: "Room not found. Check the code or create a new room." });
      broadcast(result.room);
      return sendJson(res, 200, { ok: true, code: result.room.code, playerId: result.playerId, room: publicRoom(result.room) });
    }

    if (req.method === "POST" && url.pathname === "/api/action") {
      const body = await readJson(req);
      const room = rooms.get(String(body.code || "").trim().toUpperCase());
      if (!room) return sendJson(res, 404, { ok: false, error: "Room not found." });
      const result = handleAction(room, body.playerId, body.type, body.payload);
      broadcast(room);
      return sendJson(res, result.ok ? 200 : 400, { ...result, room: publicRoom(room) });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/events/")) {
      const code = url.pathname.split("/").pop()?.toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Room not found");
        return;
      }
      const clientId = crypto.randomUUID();
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(`data: ${JSON.stringify(publicRoom(room))}\n\n`);
      room.clients.set(clientId, res);
      req.on("close", () => room.clients.delete(clientId));
      return;
    }

    return serveStatic(req, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: "Server error." });
  }
});

setInterval(() => {
  for (const room of rooms.values()) {
    room.stats.power = clamp(room.stats.power - (room.mission.started ? 1 : 0));
    if (room.stats.power < 30) room.stats.hull = clamp(room.stats.hull - 2);
    if (room.event?.id === "pirate-approach") room.stats.piratePressure = clamp(room.stats.piratePressure + 2);
    if (room.mission.started && Math.random() > 0.72) {
      const target = room.switches[Math.floor(Math.random() * room.switches.length)];
      target.alert = true;
      target.on = false;
    }
    broadcast(room);
  }
}, 9000);

server.listen(PORT, () => {
  console.log(`Treasure Crew Co-op v0.4 running at http://localhost:${PORT}`);
});

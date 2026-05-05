const app = document.querySelector("#app");

const ROLE_COPY = {
  captain: {
    eyebrow: "Radio + Navigation",
    title: "Captain Seat",
    description: "Call out radio clues, solve word screens, and keep the GPS route readable.",
  },
  engineer: {
    eyebrow: "Maintenance + Repair",
    title: "Engineer Seat",
    description: "Sort fluids, repair circuits, match parts, and keep the boat alive.",
  },
};

const WORD_GRIDS = {
  RADIO: ["R A D I O".split(" "), "W T S E A".split(" "), "P M A P L".split(" "), "C O D E K".split(" "), "B U O Y S".split(" ")],
  ANCHOR: ["A N C H O R".split(" "), "T I D E S X".split(" "), "M A S T S Y".split(" "), "B U O Y S Z".split(" "), "C O V E S Q".split(" "), "R O P E S P".split(" ")],
};

const LIQUID_START = [["sun", "sea", "rose", "sun"], ["sea", "rose", "mint", "mint"], ["rose", "sun", "sea", "mint"], []];
const MATCHING_ICONS = ["⚓", "🧭", "🔧", "💡"];
const MANUAL_SECTIONS = ["Emergency Startup", "Navigation Glossary", "Treasure Protocol", "Pirate Defense", "Storm Calls", "Secret Upgrades"];


const FALLBACK_ASSET_MANIFEST = {
  models: {
    players: [{ id: "player-default", name: "Default Crew Toy", src: "" }],
    pirates: [{ id: "pirate-default", name: "Pirate Toy Enemy", src: "assets/models/pirates/pirate-default.glb" }],
    boats: [{ id: "boat-glossy-sloop", name: "Glossy Sloop", src: "assets/models/boats/boat-glossy-sloop.glb" }],
    islands: [{ id: "island-berry-cove", name: "Berry Cove Island", src: "assets/models/islands/island-berry-cove.glb" }],
    environments: [{ id: "env-sky-cockpit", name: "Sky Cockpit Environment", src: "assets/models/environments/env-sky-cockpit.glb" }],
    steeringWheels: [
      { id: "wheel-classic", name: "Classic Toy Wheel", src: "", unlockAtManualPages: 0 },
      { id: "wheel-brass", name: "Royal Brass Wheel", src: "assets/models/steering-wheels/wheel-brass.glb", unlockAtManualPages: 1 },
      { id: "wheel-pirate", name: "Pirate Bone Wheel", src: "assets/models/steering-wheels/wheel-pirate.glb", unlockAtManualPages: 3 },
    ],
    seats: [
      { id: "seat-navy", name: "Navy Captain Chair", src: "", unlockAtManualPages: 0 },
      { id: "seat-cream", name: "Cloud Cream Chair", src: "assets/models/seats/seat-cream.glb", unlockAtManualPages: 2 },
      { id: "seat-pirate", name: "Pirate Red Chair", src: "assets/models/seats/seat-pirate.glb", unlockAtManualPages: 4 },
    ],
  },
  gui: {
    coin: "assets/gui/coin.svg",
    pearl: "assets/gui/pearl.svg",
    gem: "assets/gui/gem.svg",
    berry: "assets/gui/berry.svg",
    pirateFlag: "assets/gui/pirate-flag.svg",
    radioWave: "assets/gui/radio-wave.svg",
  },
};

const state = {
  room: null,
  playerId: localStorage.getItem("tcV04PlayerId") || "",
  code: localStorage.getItem("tcV04RoomCode") || "",
  name: localStorage.getItem("tcCrewName") || "",
  stream: null,
  error: "",
  assetManifest: FALLBACK_ASSET_MANIFEST,
};

function html(strings, ...values) {
  return strings.reduce((result, string, index) => `${result}${values[index] ?? ""}`, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || "Request failed.");
  return data;
}


async function loadAssetManifest() {
  try {
    const response = await fetch("/assets/asset-manifest.json", { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    state.assetManifest = mergeManifest(FALLBACK_ASSET_MANIFEST, manifest);
    render();
  } catch {
    state.assetManifest = FALLBACK_ASSET_MANIFEST;
  }
}

function mergeManifest(base, incoming) {
  return {
    ...base,
    ...incoming,
    models: { ...(base.models || {}), ...(incoming.models || {}) },
    gui: { ...(base.gui || {}), ...(incoming.gui || {}) },
    minigames: { ...(base.minigames || {}), ...(incoming.minigames || {}) },
  };
}

function safeClass(value) {
  return String(value || "default").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

function modelItems(category) {
  return state.assetManifest?.models?.[category] || [];
}

function modelById(category, id) {
  return modelItems(category).find((item) => item.id === id) || { id, name: id, src: "" };
}

function setName(value) {
  state.name = value;
  localStorage.setItem("tcCrewName", value);
}

function connectStream(code) {
  if (state.stream) state.stream.close();
  state.stream = new EventSource(`/api/events/${encodeURIComponent(code)}`);
  state.stream.onmessage = (event) => {
    state.room = JSON.parse(event.data);
    state.code = state.room.code;
    localStorage.setItem("tcV04RoomCode", state.code);
    render();
  };
  state.stream.onerror = () => {
    state.error = "Live sync is reconnecting. Refresh or rejoin if it stays paused.";
  };
}

async function createRoom() {
  try {
    state.error = "";
    const data = await api("/api/create", { name: state.name || "Captain" });
    state.room = data.room;
    state.playerId = data.playerId;
    state.code = data.code;
    localStorage.setItem("tcV04PlayerId", state.playerId);
    localStorage.setItem("tcV04RoomCode", state.code);
    connectStream(state.code);
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function joinRoom() {
  const input = document.querySelector("#joinCode");
  try {
    state.error = "";
    const data = await api("/api/join", { code: input.value, name: state.name || "Crewmate" });
    state.room = data.room;
    state.playerId = data.playerId;
    state.code = data.code;
    localStorage.setItem("tcV04PlayerId", state.playerId);
    localStorage.setItem("tcV04RoomCode", state.code);
    connectStream(state.code);
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

function action(type, payload = {}) {
  if (!state.room || !state.playerId) return;
  return api("/api/action", { code: state.room.code, playerId: state.playerId, type, payload }).catch((error) => {
    state.error = error.message;
    render();
  });
}

function leaveRoom() {
  if (state.stream) state.stream.close();
  state.room = null;
  state.playerId = "";
  state.code = "";
  localStorage.removeItem("tcV04PlayerId");
  localStorage.removeItem("tcV04RoomCode");
  render();
}

function render() {
  if (!state.room) return renderLanding();
  renderGame();
}

function renderLanding() {
  app.innerHTML = html`
    <main class="app-shell sky-scene">
      <section class="landing-card toy-gloss">
        <div class="logo-boat" aria-hidden="true"><div class="mini-mast"></div><div class="mini-sail"></div><div class="mini-hull"></div></div>
        <p class="eyebrow">v0.4 asset pipeline + unlocks</p>
        <h1>Treasure Crew Co-op</h1>
        <p>A two-player cockpit puzzle game. One player runs radio/navigation word tasks while the other repairs the boat with maintenance minigames. Complete both stations to unlock manual pages, treasure rounds, and cosmetic 3D asset slots for wheels, seats, boats, islands, pirates, and GUI pieces.</p>
        <label class="field-label">Crew name<input id="crewName" value="${escapeHtml(state.name)}" placeholder="Rochelle" /></label>
        <div class="landing-actions">
          <button class="primary-button" id="createRoom">Create Room</button>
          <div class="join-row"><input id="joinCode" placeholder="ROOM" maxlength="5" value="${escapeHtml(state.code)}" /><button id="joinRoom">Join</button></div>
        </div>
        <div class="status-pill">Node multiplayer server ready</div>
        ${state.error ? `<p class="error-box">${escapeHtml(state.error)}</p>` : ""}
      </section>
    </main>`;
  document.querySelector("#crewName").addEventListener("input", (event) => setName(event.target.value));
  document.querySelector("#createRoom").addEventListener("click", createRoom);
  document.querySelector("#joinRoom").addEventListener("click", joinRoom);
  document.querySelector("#joinCode").addEventListener("input", (event) => { event.target.value = event.target.value.toUpperCase(); });
}

function renderGame() {
  const room = state.room;
  const me = room.players[state.playerId];
  const mySeat = me?.seat || null;
  const players = Object.values(room.players || {});
  const activeRole = mySeat || "captain";
  const task = room.tasks[activeRole];
  const stage = room.currentStage;
  const captainName = room.seats.captain ? room.players[room.seats.captain]?.name : "Open";
  const engineerName = room.seats.engineer ? room.players[room.seats.engineer]?.name : "Open";

  app.innerHTML = html`
    <main class="app-shell sky-scene">
      <header class="topbar toy-gloss">
        <div><p class="eyebrow">room code</p><h1>${room.code}</h1></div>
        <div class="crew-list">${players.map((player) => `<span class="crew-chip ${player.id === state.playerId ? "active" : ""}">${escapeHtml(player.name)} · ${player.seat || "observer"}</span>`).join("")}</div>
        <div class="topbar-actions">
          <button data-action="seat:claim" data-seat="captain">Captain</button>
          <button data-action="seat:claim" data-seat="engineer">Engineer</button>
          <button class="accent-button" data-action="seat:swap">Swap seats</button>
          <button data-local="leave">Leave</button>
        </div>
      </header>

      ${missionBannerMarkup(room, mySeat)}

      <section class="game-layout">
        ${cockpitMarkup(room, mySeat, captainName, engineerName)}
        <aside class="role-panel toy-gloss">
          <p class="eyebrow">your touchscreen</p>
          <h2>${mySeat ? ROLE_COPY[mySeat].title : "Observer Mode"}</h2>
          <p>${mySeat ? ROLE_COPY[mySeat].description : "Claim a seat to control this side of the cockpit."}</p>
          ${mySeat ? directiveMarkup(room, mySeat) : `<p class="empty-note">Tap Captain or Engineer in the top bar to join a responsibility set.</p>`}
          ${room.treasureHunt?.active ? treasureHuntMarkup(room.treasureHunt, mySeat) : ""}
          ${mySeat && task && !room.treasureHunt?.active ? taskMarkup(task, activeRole) : ""}
          ${manualMarkup(room.stats.manualPages)}
          ${assetLockerMarkup(room, mySeat)}
        </aside>
      </section>

      <section class="mission-drawer toy-gloss">
        ${statMarkup("Hull", room.stats.hull)}
        ${statMarkup("Power", room.stats.power)}
        ${statMarkup("Morale", room.stats.morale)}
        ${statMarkup("Manual", Math.min(100, room.stats.manualPages * 18), `${room.stats.manualPages} pages`)}
        ${statMarkup("Treasure", room.stats.treasure)}
      </section>

      <section class="log-card toy-gloss">
        <div class="log-head"><h2>Captain's Log</h2><div class="quick-events"><button data-event="treasure-hunt">Treasure mode</button><button data-event="pirate-approach">Pirate mode</button></div></div>
        ${room.log.map((item) => `<p>${escapeHtml(item.text)}</p>`).join("")}
      </section>

      ${room.lastSuccess ? `<div class="toast-success">${escapeHtml(room.lastSuccess.text)}</div>` : ""}
      ${room.reveal ? revealMarkup(room.reveal) : ""}
      ${room.event ? eventMarkup(room.event) : ""}
    </main>`;

  bindGameEvents();
  if (mySeat && task) mountTask(task, activeRole);
}

function missionBannerMarkup(room, mySeat) {
  const stage = room.currentStage;
  const checklist = room.mission.checklist;
  const roleDirective = mySeat ? stage[mySeat] : "Claim a seat to see your role directive.";
  const started = room.mission.started;
  const stepNumber = room.mission.index + 1;
  return html`
    <section class="mission-banner toy-gloss ${started ? "active" : "waiting"}">
      <div>
        <p class="eyebrow">${started ? `mission ${stepNumber}` : "preflight"}</p>
        <h2>${started ? stage.title : "Start the First Voyage"}</h2>
        <p>${started ? stage.brief : "Claim seats, then begin the guided first 5-minute demo round."}</p>
      </div>
      <div class="mission-checklist">
        <span class="${checklist.captain ? "done" : ""}">Captain task</span>
        <span class="${checklist.engineer ? "done" : ""}">Engineer task</span>
      </div>
      <div class="mission-directive">
        <strong>Your directive</strong>
        <span>${escapeHtml(started ? roleDirective : "Press Start Voyage when both players are ready.")}</span>
      </div>
      <button class="primary-button" data-action="mission:start">${started ? "Restart Voyage" : "Start Voyage"}</button>
    </section>`;
}

function directiveMarkup(room, role) {
  const stage = room.currentStage;
  const complete = room.mission.checklist[role];
  return html`<div class="directive-card ${complete ? "complete" : ""}">
    <p class="eyebrow">current role goal</p>
    <strong>${complete ? "Complete — wait for your partner" : escapeHtml(stage[role])}</strong>
  </div>`;
}

function cockpitMarkup(room, mySeat, captainName, engineerName) {
  return html`
    <section class="cockpit toy-gloss" aria-label="toy boat cockpit">
      <div class="window-row">
        <div class="cockpit-window"><div class="cloud cloud-a"></div><div class="horizon"></div></div>
        <div class="cockpit-window"><div class="cloud cloud-b"></div><div class="horizon"></div></div>
        <div class="cockpit-window"><div class="cloud cloud-c"></div><div class="horizon"></div></div>
      </div>
      <div class="upper-console">
        ${radioMarkup()}
        ${breakerMarkup(room.switches)}
        ${instrumentMarkup(room.gauges)}
        ${gpsMarkup()}
        ${shifterMarkup()}
      </div>
      <div class="lower-console">
        ${playerStationMarkup("captain", captainName, mySeat === "captain", room.cosmetics?.equipped?.captainSeat)}
        ${wheelMarkup(room.cosmetics?.equipped?.steeringWheel)}
        ${playerStationMarkup("engineer", engineerName, mySeat === "engineer", room.cosmetics?.equipped?.engineerSeat)}
      </div>
      ${assetPreviewStripMarkup(room)}
    </section>`;
}

function radioMarkup() {
  return html`<div class="radio-stack"><div class="handset"><span></span><span></span><span></span></div><div class="coil">∿∿∿∿∿</div><div class="radio-unit"><div class="radio-screen"></div><div class="radio-buttons">${Array.from({ length: 8 }, () => "<i></i>").join("")}</div></div></div>`;
}

function breakerMarkup(switches) {
  return html`<div class="breaker-panel"><div class="panel-title">12V DC</div><div class="switch-grid">${switches.map((item) => `<button class="switch ${item.on ? "on" : ""}" data-switch="${item.id}"><span class="red-light ${item.alert && !item.on ? "alert" : ""}"></span><span class="toggle"></span><span class="blank-label"></span></button>`).join("")}</div></div>`;
}

function instrumentMarkup(gauges) {
  return html`<div class="instrument-panel"><div class="meter-row">${blankMeter(gauges.left)}${blankMeter(gauges.center)}</div><div class="gauge-row">${blankGauge(gauges.left)}${blankGauge(gauges.center)}${blankGauge(gauges.right)}</div></div>`;
}

function blankMeter(value) {
  return `<div class="blank-meter"><span style="transform: rotate(${value * 1.2 - 60}deg)"></span></div>`;
}

function blankGauge(value) {
  return `<div class="blank-gauge"><span style="transform: rotate(${value * 1.8 - 90}deg)"></span></div>`;
}

function gpsMarkup() {
  return `<div class="gps-grid">${Array.from({ length: 48 }, (_, index) => `<span class="${index % 7 === 0 ? "route" : ""}"></span>`).join("")}</div>`;
}

function shifterMarkup() {
  return `<div class="shifter"><div class="shifter-slot"></div><div class="shifter-arm"></div><div class="shifter-knob"></div></div>`;
}

function wheelMarkup(wheelId = "wheel-classic") {
  const wheel = modelById("steeringWheels", wheelId);
  return html`<div class="wheel-wrap wheel-skin-${safeClass(wheelId)}" title="${escapeHtml(wheel.name)}"><div class="wheel">${Array.from({ length: 8 }, (_, index) => `<span style="transform: rotate(${index * 45}deg)"></span>`).join("")}<b></b></div><div class="small-gauges">${blankGauge(31)}${blankGauge(74)}</div><div class="equipped-tag">${escapeHtml(wheel.name)}</div></div>`;
}

function playerStationMarkup(role, occupied, active, seatId = "seat-navy") {
  const isCaptain = role === "captain";
  const tablets = isCaptain
    ? tabletMarkup("RADIO", "radio") + tabletMarkup("WORDS", "word") + tabletMarkup("BUILD", "letters")
    : tabletMarkup("SORT", "liquid") + tabletMarkup("DOTS", "dots") + tabletMarkup("MATCH", "match");
  const seat = modelById("seats", seatId);
  return html`<div class="player-station seat-skin-${safeClass(seatId)} ${active ? "active" : ""}" title="${escapeHtml(seat.name)}"><div class="tablet-row">${tablets}</div><div class="seat-card"><div class="seat-back">⚓</div><div><p class="eyebrow">${ROLE_COPY[role].eyebrow}</p><h3>${ROLE_COPY[role].title}</h3><p>${escapeHtml(occupied || "Open")}</p><small>${escapeHtml(seat.name)}</small></div></div></div>`;
}

function tabletMarkup(title, visual) {
  const visuals = {
    radio: `<div class="voice-wave"><b></b><b></b><b></b><b></b></div>`,
    word: `<div class="mini-word-grid">${"QWERTYASDFGHZXCV".split("").map((letter) => `<span>${letter}</span>`).join("")}</div>`,
    letters: `<div class="letter-bank-preview"><span>B</span><span>O</span><span>A</span><span>T</span></div>`,
    liquid: `<div class="tube-preview"><span></span><span></span><span></span><span></span></div>`,
    dots: `<div class="dot-preview"><i></i><i></i><i></i><i></i></div>`,
    match: `<div class="match-preview"><span>⚓</span><span>🔧</span><span>🧭</span><span>💡</span></div>`,
  };
  return `<div class="tablet"><div class="tablet-title">${title}</div>${visuals[visual] || ""}</div>`;
}

function taskMarkup(task, role) {
  return html`<div class="task-card" data-task-role="${role}">
    <p class="eyebrow">active assignment</p>
    <h3>${escapeHtml(task.title)}</h3>
    <p><strong>Step:</strong> ${escapeHtml(task.step || task.hint)}</p>
    <p>${escapeHtml(task.hint)}</p>
    <div id="taskMount"></div>
  </div>`;
}

function manualMarkup(pages) {
  return html`<div class="manual-preview"><h3>Owner's Manual Builder</h3><p>${pages} unlocked page${pages === 1 ? "" : "s"}</p><div class="manual-pages">${MANUAL_SECTIONS.map((section, index) => `<span class="${index < pages ? "unlocked" : ""}">${section}</span>`).join("")}</div></div>`;
}

function statMarkup(name, value, suffix = `${value}%`) {
  return html`<div class="stat"><div class="stat-label"><span>${name}</span><span>${suffix}</span></div><div class="stat-track"><span style="width:${value}%"></span></div></div>`;
}

function revealMarkup(reveal) {
  return html`<div class="event-backdrop reveal-layer"><section class="event-card manual-reveal toy-gloss">
    <p class="eyebrow">owner's manual page ${reveal.pageNumber}</p>
    <h2>${escapeHtml(reveal.title)}</h2>
    <p>${escapeHtml(reveal.body)}</p>
    <div class="clue-strip">${escapeHtml(reveal.clue)}</div>
    ${unlockRevealMarkup(reveal.unlocks || [])}
    <button class="primary-button" data-action="reveal:clear">Add to Manual</button>
  </section></div>`;
}

function eventMarkup(event) {
  const treasureButtons = event.id === "treasure-hunt"
    ? `<button class="primary-button" data-action="treasure:start">Launch Treasure Round</button><button class="secondary-button" data-action="event:clear">Not yet</button>`
    : `<button class="primary-button" data-action="event:clear">Back to cockpit</button>`;
  return html`<div class="event-backdrop"><section class="event-card toy-gloss">
    <p class="eyebrow">mode unlocked</p>
    <h2>${escapeHtml(event.title)}</h2>
    <p>${escapeHtml(event.subtitle)}</p>
    <div class="event-visual">${event.icon || "🧭"}</div>
    <div class="event-actions">${treasureButtons}</div>
  </section></div>`;
}

function treasureHuntMarkup(hunt, mySeat) {
  const guesses = hunt.guesses || [];
  const isCaptain = mySeat === "captain";
  const isEngineer = mySeat === "engineer";
  const cells = ["A1","B1","C1","D1","E1","A2","B2","C2","D2","E2","A3","B3","C3","D3","E3","A4","B4","C4","D4","E4","A5","B5","C5","D5","E5"];
  const guessMap = new Map(guesses.map((guess) => [guess.coordinate, guess]));
  const status = hunt.solved ? "Treasure found" : hunt.failed ? "Signal lost" : `${hunt.maxAttempts - hunt.attempts} guesses remaining`;
  const canTap = !hunt.solved && !hunt.failed && (isEngineer || !mySeat);

  return html`<section class="treasure-panel">
    <div class="treasure-head">
      <p class="eyebrow">active treasure hunt</p>
      <h3>${escapeHtml(hunt.title)}</h3>
      <span>${escapeHtml(status)}</span>
    </div>
    <div class="treasure-role-grid">
      <div class="map-clue-card ${isCaptain ? "spotlight" : "dimmed"}">
        <p class="eyebrow">Captain map clue</p>
        <div class="mini-map-art"><span class="palm">🌴</span><span class="reef">🪸</span><span class="xmark">X</span></div>
        ${isCaptain ? `<p>${escapeHtml(hunt.clue)}</p><div class="clue-strip small">${escapeHtml(hunt.mapNote)}</div>` : `<p>Captain sees the full clue. Ask them to read it aloud.</p>`}
      </div>
      <div class="gps-play-card ${isEngineer ? "spotlight" : ""}">
        <p class="eyebrow">Engineer GPS grid</p>
        <div class="treasure-grid">${cells.map((cell) => {
          const guess = guessMap.get(cell);
          const cls = guess ? (guess.correct ? "correct" : guess.hazard ? "hazard" : "miss") : "";
          const disabled = canTap ? "" : "disabled";
          return `<button class="${cls}" data-treasure-coordinate="${cell}" ${disabled}>${cell}</button>`;
        }).join("")}</div>
        <p class="grid-help">${isEngineer ? "Tap the coordinate your partner calls out." : "Engineer taps the coordinate. Solo testing is allowed before a second player joins."}</p>
      </div>
    </div>
    <div class="guess-log">
      ${guesses.length ? guesses.slice(-4).map((guess) => `<span class="${guess.correct ? "correct" : guess.hazard ? "hazard" : "miss"}">${escapeHtml(guess.player)}: ${guess.coordinate}</span>`).join("") : `<span>No guesses yet.</span>`}
    </div>
    ${hunt.solved ? `<div class="treasure-result success"><strong>Cache opened.</strong><p>${escapeHtml(hunt.reward)}</p><button class="primary-button" data-action="treasure:clear">Collect Treasure</button></div>` : ""}
    ${hunt.failed ? `<div class="treasure-result"><strong>Signal lost.</strong><p>Relaunch the map to try another clue.</p><button class="primary-button" data-action="treasure:start">Relaunch Hunt</button><button class="secondary-button" data-action="treasure:clear">Close</button></div>` : ""}
  </section>`;
}


function unlockRevealMarkup(unlocks = []) {
  if (!unlocks.length) return "";
  return `<div class="unlock-reveal"><p class="eyebrow">new cosmetic unlock</p>${unlocks.map((item) => `<span>${escapeHtml(item.name)}</span>`).join("")}</div>`;
}

function assetPreviewStripMarkup(room) {
  const equipped = room.cosmetics?.equipped || {};
  const items = [
    ["boat", modelById("boats", equipped.boat || "boat-glossy-sloop")],
    ["wheel", modelById("steeringWheels", equipped.steeringWheel || "wheel-classic")],
    ["captain seat", modelById("seats", equipped.captainSeat || "seat-navy")],
    ["engineer seat", modelById("seats", equipped.engineerSeat || "seat-navy")],
  ];
  return `<div class="asset-preview-strip">${items.map(([label, item]) => `<div class="asset-pill"><span>${label}</span><strong>${escapeHtml(item.name || item.id)}</strong></div>`).join("")}</div>`;
}

function assetLockerMarkup(room, mySeat) {
  const cosmetics = room.cosmetics || { unlocked: {}, equipped: {} };
  const gui = state.assetManifest?.gui || {};
  return html`<section class="asset-locker">
    <div class="asset-locker-head">
      <p class="eyebrow">asset locker v0.4</p>
      <h3>3D Models + GUI Assets</h3>
      <p>Drop GLB models into <code>public/assets/models</code>, then update the manifest. Unlocked wheels and seats can be equipped live by room.</p>
    </div>
    <div class="gui-asset-row">
      ${Object.entries(gui).map(([name, src]) => `<span><img src="/${src}" alt="${escapeHtml(name)}" />${escapeHtml(name)}</span>`).join("")}
    </div>
    <div class="cosmetic-groups">
      ${cosmeticGroupMarkup("steeringWheels", "Steering Wheels", cosmetics.unlocked?.steeringWheels || [], cosmetics.equipped?.steeringWheel)}
      ${cosmeticGroupMarkup("seats", "Captain Seat", cosmetics.unlocked?.seats || [], cosmetics.equipped?.captainSeat, "captain")}
      ${cosmeticGroupMarkup("seats", "Engineer Seat", cosmetics.unlocked?.seats || [], cosmetics.equipped?.engineerSeat, "engineer")}
    </div>
    <details class="model-intake"><summary>Model intake checklist</summary>${modelIntakeMarkup()}</details>
  </section>`;
}

function cosmeticGroupMarkup(category, title, unlockedIds, equippedId, target = "") {
  const items = modelItems(category);
  return `<div class="cosmetic-group"><h4>${title}</h4>${items.map((item) => {
    const unlocked = unlockedIds.includes(item.id);
    const equipped = equippedId === item.id;
    const src = item.src || "";
    return `<button class="cosmetic-card ${equipped ? "equipped" : ""}" data-equip-category="${category}" data-equip-id="${item.id}" data-equip-target="${target}" ${unlocked ? "" : "disabled"}>
      <span class="mini-model-preview ${src ? "has-model" : "fallback"}">${src ? modelViewerMarkup(src, item.name) : previewIcon(category, item.id)}</span>
      <strong>${escapeHtml(item.name || item.id)}</strong>
      <small>${equipped ? "Equipped" : unlocked ? "Unlocked" : `Unlock page ${item.unlockAtManualPages ?? "?"}`}</small>
    </button>`;
  }).join("")}</div>`;
}

function modelViewerMarkup(src, label) {
  const safeSrc = src.startsWith("/") ? src : `/${src}`;
  return `<model-viewer src="${escapeHtml(safeSrc)}" camera-controls auto-rotate disable-zoom interaction-prompt="none" ar-status="not-presenting" alt="${escapeHtml(label || "3D model")}"></model-viewer>`;
}

function previewIcon(category, id) {
  if (category === "steeringWheels") return "☸";
  if (category === "seats") return "💺";
  if (String(id).includes("pirate")) return "☠️";
  return "⬡";
}

function modelIntakeMarkup() {
  const sections = [
    ["players", "Player avatars and floating heads"],
    ["pirates", "Pirate enemies and NPCs"],
    ["boats", "Player boat and pirate ships"],
    ["islands", "Treasure islands and destinations"],
    ["environments", "Cockpit, ocean, sky, and island environments"],
    ["steeringWheels", "Unlockable steering wheel cosmetics"],
    ["seats", "Unlockable player seat cosmetics"],
  ];
  return `<div class="model-intake-grid">${sections.map(([key, label]) => {
    const items = modelItems(key);
    const ready = items.filter((item) => item.src).length;
    return `<div><strong>${label}</strong><span>${ready}/${items.length} manifest slots point to model files</span><code>assets/models/${key.replace("steeringWheels", "steering-wheels")}</code></div>`;
  }).join("")}</div>`;
}

function bindGameEvents() {
  document.querySelectorAll("[data-action='mission:start']").forEach((button) => button.addEventListener("click", () => action("mission:start")));
  document.querySelectorAll("[data-action='seat:claim']").forEach((button) => button.addEventListener("click", () => action("seat:claim", { seat: button.dataset.seat })));
  document.querySelectorAll("[data-action='seat:swap']").forEach((button) => button.addEventListener("click", () => action("seat:swap")));
  document.querySelectorAll("[data-action='event:clear']").forEach((button) => button.addEventListener("click", () => action("event:clear")));
  document.querySelectorAll("[data-action='reveal:clear']").forEach((button) => button.addEventListener("click", () => action("reveal:clear")));
  document.querySelectorAll("[data-action='treasure:start']").forEach((button) => button.addEventListener("click", () => action("treasure:start")));
  document.querySelectorAll("[data-action='treasure:clear']").forEach((button) => button.addEventListener("click", () => action("treasure:clear")));
  document.querySelectorAll("[data-treasure-coordinate]").forEach((button) => button.addEventListener("click", () => action("treasure:guess", { coordinate: button.dataset.treasureCoordinate })));
  document.querySelectorAll("[data-local='leave']").forEach((button) => button.addEventListener("click", leaveRoom));
  document.querySelectorAll("[data-switch]").forEach((button) => button.addEventListener("click", () => action("switch:toggle", { id: button.dataset.switch })));
  document.querySelectorAll("[data-event]").forEach((button) => button.addEventListener("click", () => action("event:trigger", { id: button.dataset.event })));
  document.querySelectorAll("[data-equip-category]").forEach((button) => button.addEventListener("click", () => action("cosmetic:equip", { category: button.dataset.equipCategory, id: button.dataset.equipId, target: button.dataset.equipTarget })));
}

function completeTask(role, note) {
  action("task:complete", { role, result: { note } });
}

function mountTask(task, role) {
  const mount = document.querySelector("#taskMount");
  if (!mount) return;
  if (task.type === "word-search") return mountWordSearch(mount, task, role);
  if (task.type === "letter-bank") return mountLetterBank(mount, task, role);
  if (task.type === "liquid-sort") return mountLiquidSort(mount, role);
  if (task.type === "connect-dots") return mountConnectDots(mount, role);
  if (task.type === "matching") return mountMatching(mount, role);
}

function mountWordSearch(mount, task, role) {
  const grid = WORD_GRIDS[task.target] || WORD_GRIDS.RADIO;
  const target = task.target.split("");
  let selected = [];
  const draw = () => {
    const current = selected.map((cell) => grid[cell.r][cell.c]).join("");
    mount.innerHTML = html`<div class="target-word">Target: ${task.target}</div><div class="word-grid" style="grid-template-columns: repeat(${grid[0].length}, 1fr)">${grid.map((row, r) => row.map((letter, c) => `<button class="${selected.some((cell) => cell.r === r && cell.c === c) ? "selected" : ""}" data-r="${r}" data-c="${c}">${letter}</button>`).join("")).join("")}</div><div class="answer-strip">${current || "tap letters in order"}</div>`;
    mount.querySelectorAll("[data-r]").forEach((button) => button.addEventListener("click", () => {
      const r = Number(button.dataset.r);
      const c = Number(button.dataset.c);
      const letter = grid[r][c];
      if (letter === target[selected.length]) selected.push({ r, c });
      else selected = [];
      if (selected.map((cell) => grid[cell.r][cell.c]).join("") === task.target) {
        draw();
        setTimeout(() => completeTask(role, `decoded ${task.target}`), 350);
      } else draw();
    }));
  };
  draw();
}

function mountLetterBank(mount, task, role) {
  const letters = task.letters.split("");
  let used = [];
  const draw = () => {
    const answer = used.map((item) => item.letter).join("");
    mount.innerHTML = html`<div class="target-word">Build: ${task.target}</div><div class="answer-strip large">${answer || "_".repeat(task.target.length)}</div><div class="letter-bank">${letters.map((letter, index) => `<button data-letter="${letter}" data-index="${index}" ${used.some((item) => item.index === index) ? "disabled" : ""}>${letter}</button>`).join("")}</div><button class="secondary-button" data-reset>Reset letters</button>`;
    mount.querySelectorAll("[data-letter]").forEach((button) => button.addEventListener("click", () => {
      used.push({ letter: button.dataset.letter, index: Number(button.dataset.index) });
      if (used.map((item) => item.letter).join("") === task.target) {
        draw();
        setTimeout(() => completeTask(role, `built ${task.target}`), 350);
      } else draw();
    }));
    mount.querySelector("[data-reset]").addEventListener("click", () => { used = []; draw(); });
  };
  draw();
}

function mountLiquidSort(mount, role) {
  let tubes = LIQUID_START.map((tube) => [...tube]);
  let selected = null;
  const isSolved = () => tubes.every((tube) => tube.length === 0 || (tube.length === 4 && tube.every((item) => item === tube[0])));
  const draw = () => {
    mount.innerHTML = html`<div class="liquid-game">${tubes.map((tube, index) => `<button class="tube ${selected === index ? "selected" : ""}" data-tube="${index}">${Array.from({ length: 4 }, (_, slot) => `<span class="liquid ${tube[slot] || "empty"}"></span>`).join("")}</button>`).join("")}</div><button class="secondary-button" data-reset>Reset tubes</button>`;
    mount.querySelectorAll("[data-tube]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.tube);
      if (selected === null) {
        if (tubes[index].length) selected = index;
      } else if (selected === index) {
        selected = null;
      } else {
        const source = tubes[selected];
        const destination = tubes[index];
        const color = source[source.length - 1];
        if (color && destination.length < 4 && (!destination.length || destination[destination.length - 1] === color)) destination.push(source.pop());
        selected = null;
      }
      if (isSolved()) {
        draw();
        setTimeout(() => completeTask(role, "fluids balanced"), 500);
      } else draw();
    }));
    mount.querySelector("[data-reset]").addEventListener("click", () => { tubes = LIQUID_START.map((tube) => [...tube]); selected = null; draw(); });
  };
  draw();
}

function mountConnectDots(mount, role) {
  const dots = [{ n: 1, x: 12, y: 62 }, { n: 2, x: 28, y: 22 }, { n: 3, x: 48, y: 72 }, { n: 4, x: 66, y: 28 }, { n: 5, x: 84, y: 58 }];
  let nextDot = 1;
  const draw = () => {
    const points = dots.filter((dot) => dot.n < nextDot).map((dot) => `${dot.x},${dot.y}`).join(" ");
    mount.innerHTML = html`<div class="dots-game"><svg viewBox="0 0 100 100"><polyline points="${points}"></polyline></svg>${dots.map((dot) => `<button class="dot ${dot.n < nextDot ? "complete" : ""}" style="left:${dot.x}%;top:${dot.y}%" data-dot="${dot.n}">${dot.n}</button>`).join("")}</div>`;
    mount.querySelectorAll("[data-dot]").forEach((button) => button.addEventListener("click", () => {
      const dot = Number(button.dataset.dot);
      nextDot = dot === nextDot ? nextDot + 1 : 1;
      if (nextDot > dots.length) {
        draw();
        setTimeout(() => completeTask(role, "circuit path restored"), 450);
      } else draw();
    }));
  };
  draw();
}

function mountMatching(mount, role) {
  const cards = shuffle([...MATCHING_ICONS, ...MATCHING_ICONS].map((icon, index) => ({ icon, id: `${icon}-${index}` })));
  let open = [];
  let matched = [];
  const draw = () => {
    mount.innerHTML = `<div class="matching-game">${cards.map((card, index) => {
      const visible = open.includes(index) || matched.includes(card.id);
      return `<button class="match-card ${visible ? "open" : ""}" data-card="${index}">${visible ? card.icon : "?"}</button>`;
    }).join("")}</div>`;
    mount.querySelectorAll("[data-card]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.card);
      if (open.includes(index) || matched.includes(cards[index].id) || open.length >= 2) return;
      open.push(index);
      draw();
      if (open.length === 2) {
        setTimeout(() => {
          const [a, b] = open;
          if (cards[a].icon === cards[b].icon) matched.push(cards[a].id, cards[b].id);
          open = [];
          if (matched.length === cards.length) {
            draw();
            setTimeout(() => completeTask(role, "parts matched"), 400);
          } else draw();
        }, 500);
      }
    }));
  };
  draw();
}

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

render();
loadAssetManifest();

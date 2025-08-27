// app.js - לוגיקה ראשית של האפליקציה

// ------------------ מודל נתונים ------------------
const DEFAULT_DATA = {
  version: 1,
  players: {}, // id -> {id, name}
  tournaments: [],
  settings: { points: { win: 1, mars: 2 } },
  activeTournamentId: null
};

let data = structuredClone(DEFAULT_DATA);

let sortState = { column: 'points', dir: 'desc' };
const lastTournamentStats = {}; // cache previous stats for animations

// ------------------ עזרי ID וזמן ------------------
const genId = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ------------------ גישה ל-DOM ------------------
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

// ------------------ אירועים עיקריים ------------------
window.addEventListener('DOMContentLoaded', () => {
  bindUI();
  loadDataFromServer();
});

function bindUI() {
  // Minimalist Clarity UI bindings
  const dashboard = qs('#dashboard');
  const liveView = qs('#liveView');
  const playersModal = qs('#playersModal');
  const tournamentModal = qs('#tournamentModal');
  const openPlayersBtn = qs('[data-action="open-players"]');
  const openTournBtn = qs('[data-action="open-tournament"]');
  const closePlayers = qs('[data-action="close-players"]');
  const closeTourn = qs('[data-action="close-tournament"]');
  const participantsList = qs('#participantsList');

  if (!openPlayersBtn || !openTournBtn) return; // Elements not found

  openPlayersBtn.addEventListener('click', () => {
    renderPlayers();
    playersModal.classList.add('active');
  });
  closePlayers.addEventListener('click', () => playersModal.classList.remove('active'));

  openTournBtn.addEventListener('click', () => {
    renderParticipantsChecklist();
    tournamentModal.classList.add('active');
  });
  closeTourn.addEventListener('click', () => tournamentModal.classList.remove('active'));

  function renderParticipantsChecklist() {
    participantsList.innerHTML = '';
    Object.values(data.players)
      .sort((a,b)=>a.name.localeCompare(b.name,'he'))
      .forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<label><input type="checkbox" value="${p.id}"/> ${p.name}</label>`;
        participantsList.appendChild(li);
      });
  }

  // Override forms
  qs('#formAddPlayer').addEventListener('submit', onAddPlayer);
  qs('#formNewTournament').addEventListener('submit', e => {
    e.preventDefault();
    const name = qs('#tournamentName').value.trim();
    const type = qs('input[name="type"]:checked', tournamentModal).value;
    const participants = [...participantsList.querySelectorAll('input:checked')].map(i=>i.value);
    if (participants.length < 2) { alert('נדרשים לפחות שני שחקנים'); return; }
    const id = genId('tmt');
    const t = { id, name, type, participants, createdAt: new Date().toISOString(), status:'active', rounds:[], bracket:null, standings:[] };
    generateSchedule(t);
    data.tournaments.push(t);
    data.activeTournamentId = id;
    afterDataChange();
    tournamentModal.classList.remove('active');
    dashboard.classList.add('hidden');
    liveView.classList.remove('hidden');
    renderActiveTournament();
  });

  // Close live view
  qs('#btnCloseTournament').addEventListener('click', () => {
    closeActiveTournament();
    dashboard.classList.remove('hidden');
    liveView.classList.add('hidden');
  });

  // Scoreboard sorting
  const scoreboardHead = qs('#scoreboardTable thead');
  if (scoreboardHead) {
    scoreboardHead.addEventListener('click', onSortScoreboard);
  }

  // Archive and utilities bindings
  const openArchiveBtn = qs('[data-action="open-archive"]');
  const archiveModal = qs('#archiveModal');
  const closeArchive = qs('[data-action="close-archive"]');
  const pastTournamentModal = qs('#pastTournamentModal');
  const closePast = qs('[data-action="close-past"]');

  if (openArchiveBtn && archiveModal) {
    openArchiveBtn.addEventListener('click', () => {
      renderPastTournaments();
      archiveModal.classList.add('active');
    });
  }
  if (closeArchive && archiveModal) closeArchive.addEventListener('click', () => archiveModal.classList.remove('active'));
  if (closePast && pastTournamentModal) closePast.addEventListener('click', () => pastTournamentModal.classList.remove('active'));

  
}



async function loadDataFromServer() {
  try {
    const response = await fetch('/get-data');
    if (response.ok) {
      const json = await response.json();
      data = json;
      console.log('Data loaded from server');
    } else {
      throw new Error('Failed to load data from server');
    }
    refreshAll();
  } catch (err) {
    console.warn('Error loading data from server:', err.message);
    // Start with default data if server is not available or file doesn't exist
    data = structuredClone(DEFAULT_DATA);
    alert('Using default data - could not load from server.');
    refreshAll();
  }
}

async function autoSaveIfPossible() {
  try {
    const response = await fetch('/save-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to save data to server');
    }
    console.log('Data saved to server');
  } catch (error) {
    console.error('Error auto-saving data:', error);
  }
}

// ------------------ ניהול שחקנים ------------------
function onAddPlayer(e) {
  e.preventDefault();
  const name = qs('#playerName').value.trim();
  if (!name) return;
  const id = genId('plr');
  data.players[id] = { id, name };
  qs('#playerName').value = '';
  afterDataChange();
}

function removePlayer(id) {
  if (!confirm('להסיר שחקן זה?')) return;
  delete data.players[id];
  // גם להסיר מטורנירים עתידיים לא מסתיימים
  data.tournaments.forEach(t => {
    if (t.status !== 'completed') {
      t.participants = t.participants.filter(p => p !== id);
    }
  });
  afterDataChange();
}

function renderPlayers() {
  const list = qs('#playersList');
  list.innerHTML = '';
  Object.values(data.players).sort((a,b)=>a.name.localeCompare(b.name, 'he')).forEach(p => {
    const li = document.createElement('li');
    li.className = 'player-item';
    li.innerHTML = `<span class="player-name clickable" data-id="${p.id}">${p.name}</span> <button class="remove-player" data-id="${p.id}" aria-label="הסר">✕</button>`;
    list.appendChild(li);
  });
  list.addEventListener('click', onPlayersListClick, { once: true });
  if (qs('#participantsSelect')) renderParticipantsSelect();
}

function onPlayersListClick(e) {
  const removeBtn = e.target.closest('.remove-player');
  if (removeBtn) {
    removePlayer(removeBtn.dataset.id);
    return;
  }
  const nameSpan = e.target.closest('.player-name');
  if (nameSpan) {
    showPlayerProfile(nameSpan.dataset.id);
  }
  // האזנה שוב לאירועים עתידיים
  qs('#playersList').addEventListener('click', onPlayersListClick, { once: true });
}

function renderParticipantsSelect() {
  const sel = qs('#participantsSelect');
  if (!sel) return;
  const prev = new Set([...sel.selectedOptions].map(o => o.value));
  sel.innerHTML = Object.values(data.players)
    .sort((a,b)=>a.name.localeCompare(b.name,'he'))
    .map(p => `<option value="${p.id}" ${prev.has(p.id)?'selected':''}>${p.name}</option>`)
    .join('');
}

// ------------------ יצירת טורניר ------------------
function onCreateTournament(e) {
  e.preventDefault();
  const name = qs('#tournamentName').value.trim();
  if (!name) return;
  const type = qs('#tournamentType').value;
  const participants = [...qs('#participantsSelect').selectedOptions].map(o => o.value);
  if (participants.length < 2) { alert('נדרשים לפחות שני שחקנים'); return; }
  const id = genId('tmt');
  const tournament = {
    id,
    name,
    type,
    participants: [...participants],
    createdAt: new Date().toISOString(),
    status: 'active',
    rounds: [],
    bracket: null,
    standings: []
  };
  generateSchedule(tournament);
  data.tournaments.push(tournament);
  data.activeTournamentId = id;
  qs('#tournamentName').value='';
  afterDataChange();
}

function generateSchedule(t) {
  if (t.type === 'round_robin') return generateRoundRobin(t);
  if (t.type === 'single_elim') return generateSingleElim(t);
  if (t.type === 'double_elim') return generateDoubleElim(t);
}

function generateRoundRobin(t) {
  const players = [...t.participants];
  if (players.length % 2 === 1) players.push(null); // בייא
  const n = players.length;
  const rounds = n - 1;
  for (let r = 0; r < rounds; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const p1 = players[i];
      const p2 = players[n - 1 - i];
      if (p1 != null && p2 != null) {
        matches.push(newMatch(p1, p2));
      }
    }
    t.rounds.push({ matches });
    // סבב סיבוב שעון - שיטת circle
    players.splice(1, 0, players.pop());
  }
}

function newMatch(p1, p2) {
  return { id: genId('m'), p1, p2, winner: null, mars: false, pointsAwarded: null };
}

function generateSingleElim(t) {
  const players = shuffle([...t.participants]);
  let size = 1; while (size < players.length) size *= 2;
  const byes = size - players.length;
  const bracket = { rounds: [] };
  let current = [];
  let idx = 0;
  for (let i=0;i<size;i+=2) {
    const p1 = players[idx++] ?? null;
    const p2 = players[idx++] ?? null;
    if (p2 === null && p1 !== null) {
      // bye, auto advance
      current.push({ id: genId('bm'), p1, p2: null, winner: p1, mars:false, bye:true });
    } else {
      current.push({ id: genId('bm'), p1, p2, winner: null, mars:false, bye:false });
    }
  }
  bracket.rounds.push(current);
  // build placeholder future rounds
  while (current.length > 1) {
    const next = [];
    for (let i=0;i<current.length;i+=2) {
      next.push({ id: genId('bm'), from: [current[i].id, current[i+1]?.id], winner: null });
    }
    bracket.rounds.push(next);
    current = next;
  }
  t.bracket = bracket;
}

function generateDoubleElim(t) {
  // פשטות: נתחיל כמו single elim ונוסיף שדה loserBracket כ-list ריק; נוכל להשלים לוגיקה בהמשך
  generateSingleElim(t);
  t.bracket.loserRounds = [];
  t.bracket.finalMatch = null;
}

function shuffle(arr) { for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()* (i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

// ------------------ עידכון תוצאות ------------------
function renderActiveTournament() {
  const dashboard = qs('#dashboard');
  const liveView = qs('#liveView');
  const titleEl = qs('#activeTournamentTitle');
  const bracketPanel = qs('#bracketPanel');

  const t = data.tournaments.find(t => t.id === data.activeTournamentId && t.status==='active');
  if (!t) {
    if (liveView) liveView.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    return;
  }

  if (dashboard) dashboard.classList.add('hidden');
  if (liveView) liveView.classList.remove('hidden');
  if (titleEl) titleEl.textContent = `${t.name} (${typeLabel(t.type)})`;

  if (t.type === 'round_robin') {
    if (bracketPanel) bracketPanel.style.display = 'none';
    renderRoundRobinMatches(t);
  } else {
    if (bracketPanel) bracketPanel.style.display = '';
    renderElimBracket(t);
    renderElimOpenMatches(t);
  }
  renderScoreboard(t);
}

function typeLabel(type) {
  return { round_robin: 'ליגה', single_elim: 'נוקאאוט', double_elim: 'נוקאאוט כפול' }[type] || type;
}

function renderRoundRobinMatches(t) {
  const container = qs('#matchesContainer');
  container.innerHTML = '';
  t.rounds.forEach((r, ri) => {
    r.matches.forEach(m => {
      if (!m.winner) {
        container.appendChild(matchCard(t, m, `מחזור ${ri+1}`));
      }
    });
  });
  if (!container.children.length) container.innerHTML = '<div class="text-muted">אין משחקים פתוחים</div>';
}

function renderElimOpenMatches(t) {
  const container = qs('#matchesContainer');
  container.innerHTML='';
  // פתוחים בסיבוב נוכחי = כאלה עם שני שחקנים וללא winner
  const open = [];
  if (t.bracket) {
    for (const round of t.bracket.rounds) {
      for (const node of round) {
        if (node.p1 && node.p2 && !node.winner) open.push(node);
      }
    }
  }
  open.forEach(m=>container.appendChild(matchCard(t,m,'בראקט')));
  if (!open.length) container.innerHTML = '<div class="text-muted">אין משחקים פתוחים</div>';
}

function matchCard(t, m, label) {
  const div = document.createElement('div');
  div.className = 'match-card';
  const p1 = playerName(m.p1); const p2 = playerName(m.p2);
  div.innerHTML = `<header>${label}</header>
    <div class="vs-line"><span>${p1}</span> <span>מול</span> <span>${p2}</span></div>
    <form class="mt-1 d-flex flex-wrap gap-2 align-items-center" data-match="${m.id}">
      <label><input type="radio" name="winner-${m.id}" value="${m.p1}" required> <span>${p1}</span></label>
      <label><input type="radio" name="winner-${m.id}" value="${m.p2}" required> <span>${p2}</span></label>
      <label class="m-0"><input type="checkbox" id="mars-${m.id}" value="1"> <span>מרס</span></label>
      <button class="btn-neon secondary" type="submit">עדכן</button>
    </form>`;
  div.querySelector('form').addEventListener('submit', e => onSubmitMatchResult(e, t, m));
  return div;
}

function onSubmitMatchResult(e, t, m) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const winner = fd.get(`winner-${m.id}`);
  const mars = e.target.querySelector(`#mars-${m.id}`).checked;
  if (!winner) return;
  m.winner = winner;
  m.mars = mars;
  // ניקוד נשמר לחישוב קל בעתיד
  const pts = mars ? data.settings.points.mars : data.settings.points.win;
  m.pointsAwarded = { [winner]: pts };
  propagateElimAdvance(t, m);
  afterDataChange();
}

function propagateElimAdvance(t, m) {
  if (t.type === 'single_elim' || t.type === 'double_elim') {
    // מציאת node ב-bracket והעברתו לשלב הבא
    if (!t.bracket) return;
    for (let ri=0; ri < t.bracket.rounds.length-1; ri++) {
      const round = t.bracket.rounds[ri];
      const idx = round.findIndex(n => n.id === m.id);
      if (idx !== -1) {
        const targetRound = t.bracket.rounds[ri+1];
        const targetNode = targetRound[Math.floor(idx/2)];
        if (!targetNode.p1) targetNode.p1 = m.winner; else if (!targetNode.p2) targetNode.p2 = m.winner;
        break;
      }
    }
    // לסגור טורניר אם גמר הוכרע
    const lastRound = t.bracket.rounds[t.bracket.rounds.length-1];
    if (lastRound.length === 1 && lastRound[0].winner) {
      handleTournamentCompletion(t);
    }
  }
  if (t.type === 'round_robin') {
    // לבדוק אם כל המשחקים הושלמו
    if (t.rounds.every(r => r.matches.every(m=>m.winner))) {
      handleTournamentCompletion(t);
    }
  }
}

// ------------------ טבלת ניקוד ------------------
function renderScoreboard(t) {
  const tbody = qs('#scoreboardTable tbody');
  const prev = lastTournamentStats[t.id] || {};
  const stats = computeTournamentStats(t);
  let rows = Object.values(stats);
  rows.sort(scoreSortFn);
  tbody.innerHTML = rows.map(r => `<tr data-id="${r.id}">
    <td class="clickable player-link">${r.name}</td>
    <td data-k="wins">${r.wins}</td>
    <td data-k="losses">${r.losses}</td>
    <td data-k="marsWins">${r.marsWins}</td>
    <td data-k="points">${r.points}</td>
  </tr>`).join('');
  tbody.querySelectorAll('.player-link').forEach(td => td.addEventListener('click', () => showPlayerProfile(td.parentElement.dataset.id)));
  [...tbody.rows].forEach((r,i)=> { if (i<3) r.classList.add(`top-${i+1}`); });
  [...tbody.rows].forEach(row => {
    const id = row.dataset.id;
    const prevStats = prev[id];
    if (!prevStats) { row.classList.add('row-updated'); return; }
    qsa('[data-k]', row).forEach(cell => {
      const k = cell.dataset.k;
      const newVal = stats[id][k];
      if (prevStats[k] !== newVal) cell.classList.add('flip-update');
    });
  });
  lastTournamentStats[t.id] = {};
  Object.values(stats).forEach(s => { lastTournamentStats[t.id][s.id] = { wins:s.wins, losses:s.losses, marsWins:s.marsWins, points:s.points }; });
}

function scoreSortFn(a,b) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  if (sortState.column === 'name') return dir * a.name.localeCompare(b.name,'he');
  return dir * ((b[sortState.column]??0) - (a[sortState.column]??0));
}

function onSortScoreboard(e) {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const col = th.dataset.sort;
  if (sortState.column === col) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.column = col; sortState.dir = col==='name'?'asc':'desc'; }
  const t = data.tournaments.find(t => t.id === data.activeTournamentId && t.status==='active');
  if (t) renderScoreboard(t);
}

function computeTournamentStats(t) {
  const stats = {};
  t.participants.forEach(pid => stats[pid] = { id: pid, name: playerName(pid), wins:0, losses:0, marsWins:0, points:0 });
  const registerMatch = (m) => {
    if (!m.winner) return;
    const loser = m.p1 === m.winner ? m.p2 : m.p1;
    if (!stats[m.winner]) stats[m.winner] = { id:m.winner, name:playerName(m.winner), wins:0, losses:0, marsWins:0, points:0 };
    if (!stats[loser]) stats[loser] = { id:loser, name:playerName(loser), wins:0, losses:0, marsWins:0, points:0 };
    stats[m.winner].wins++;
    if (m.mars) stats[m.winner].marsWins++;
    stats[m.winner].points += m.mars? data.settings.points.mars : data.settings.points.win;
    stats[loser].losses++;
  };
  if (t.type === 'round_robin') {
    t.rounds.forEach(r => r.matches.forEach(registerMatch));
  } else if (t.bracket) {
    t.bracket.rounds.forEach(r => r.forEach(n => { if (n.p1 && n.p2 && n.winner) registerMatch(n); }));
  }
  return stats;
}

function computeStandings(t) {
  const stats = computeTournamentStats(t);
  t.standings = Object.values(stats).sort((a,b)=> b.points - a.points || b.wins - a.wins);
}

// ------------------ בראקט ------------------
function renderElimBracket(t) {
  const container = qs('#bracketContainer');
  container.innerHTML='';
  if (!t.bracket) return;
  t.bracket.rounds.forEach((round, idx) => {
    const col = document.createElement('div');
    col.className = 'bracket-round';
  col.innerHTML = `<div class="bracket-round-title mb-2">סיבוב ${idx+1}</div>`;
    round.forEach(match => {
      const div = document.createElement('div');
      div.className = 'bracket-match ' + (match.winner? 'winner-decided':'');
      const p1 = match.p1? playerName(match.p1): '—';
      const p2 = match.p2? playerName(match.p2): '—';
      const w = match.winner ? `<div class="small text-success">מנצח: ${playerName(match.winner)}</div>`:'';
      div.innerHTML = `<div>${p1}</div><div>${p2}</div>${w}`;
      col.appendChild(div);
    });
    container.appendChild(col);
  });
}

// ------------------ פרופיל שחקן ------------------
function showPlayerProfile(playerId) {
  const name = playerName(playerId);
  if (!name) return;
  const section = qs('#playerProfileSection');
  const body = qs('#playerProfileBody');
  const stats = aggregatePlayerStats(playerId);

  // Render into profile panel if present, otherwise show a compact dialog (keeps UX functional).
  if (section && body) {
    body.innerHTML = `
      <h6 class="mb-2">${name}</h6>
      <div class="row small g-2">
        <div class="col-6 col-md-4">נצחונות: <strong>${stats.wins}</strong></div>
        <div class="col-6 col-md-4">הפסדים: <strong>${stats.losses}</strong></div>
        <div class="col-6 col-md-4">מרסים: <strong>${stats.marsWins}</strong></div>
        <div class="col-6 col-md-4">יחס ניצחון: <strong>${stats.ratio.toFixed(2)}</strong></div>
        <div class="col-12">טורנירים: ${stats.tournaments.map(t=>`<span class="badge bg-secondary me-1">${t}</span>`).join('')}</div>
      </div>`;
    section.classList.remove('d-none');
    section.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert(`${name}
נצחונות: ${stats.wins}
הפסדים: ${stats.losses}
מרסים: ${stats.marsWins}
יחס ניצחון: ${stats.ratio.toFixed(2)}`);
  }
}

function aggregatePlayerStats(pid) {
  let wins=0, losses=0, marsWins=0; const tournaments=[];
  data.tournaments.forEach(t => {
    let participated = t.participants.includes(pid);
    const collectMatch = (m) => {
      if (!m.winner) return; if (m.p1!==pid && m.p2!==pid) return;
      participated = true;
      if (m.winner === pid) { wins++; if (m.mars) marsWins++; } else { losses++; }
    };
    if (t.type==='round_robin') t.rounds.forEach(r=>r.matches.forEach(collectMatch));
    else if (t.bracket) t.bracket.rounds.forEach(r=>r.forEach(n=> { if (n.p1 && n.p2) collectMatch(n); }));
    if (participated) tournaments.push(t.name);
  });
  const ratio = (wins+losses)? wins/(wins+losses):0;
  return { wins, losses, marsWins, ratio, tournaments };
}

// ------------------ טורנירי עבר ------------------
function renderPastTournaments() {
  const list = qs('#pastTournaments');
  if (!list) return;
  list.innerHTML = '';
  data.tournaments.filter(t => t.status==='completed').sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).forEach(t => {
    if (!t.standings || !t.standings.length) computeStandings(t);
    const top = t.standings[0];
    const li = document.createElement('li');
    li.className = 'past-tournament-card clickable';
    li.dataset.id = t.id;
    li.innerHTML = `<div class="title">${t.name}</div><div class="meta"><span class="badge-type">${typeLabel(t.type)}</span>${top? `<span class=\"tag\">מנצח: ${top.name}</span>`:''}</div>`;
    li.addEventListener('click', () => showPastTournament(t.id));
    list.appendChild(li);
  });
}

function renderLiveTournaments() {
  const list = qs('#liveTournamentsList');
  if (!list) return;

  const liveTournaments = data.tournaments.filter(t => t.status !== 'completed');

  if (liveTournaments.length === 0) {
    list.innerHTML = '<li>אין טורנירים פעילים כרגע.</li>';
    return;
  }

  list.innerHTML = '';
  liveTournaments.forEach(t => {
    const li = document.createElement('li');
    li.className = 'clickable';
    li.innerHTML = `<span class="tournament-name">${t.name}</span> <span class="badge">${typeLabel(t.type)}</span>`;
    li.addEventListener('click', () => {
      data.activeTournamentId = t.id;
      qs('#liveTournamentsModal').classList.remove('active');
      qs('#dashboard').classList.add('hidden');
      qs('#liveView').classList.remove('hidden');
      renderActiveTournament();
    });
    list.appendChild(li);
  });
}

function showPastTournament(id) {
  const t = data.tournaments.find(t=>t.id===id);
  if (!t) return;
  if (!t.standings || !t.standings.length) computeStandings(t);

  const title = qs('#pastTournamentTitle');
  const body = qs('#pastTournamentBody');
  const modal = qs('#pastTournamentModal');
  const archiveModal = qs('#archiveModal');

  if (title && body && modal) {
    title.textContent = `${t.name} - ${typeLabel(t.type)}`;
    const created = new Date(t.createdAt).toLocaleString('he-IL');
    body.innerHTML = `
      <div class="small text-muted">נוצר: ${created}</div>
      <ol class="mb-2">
        ${t.standings.map(s => `<li>${s.name} — ${s.points} נקודות</li>`).join('')}
      </ol>
    `;
    if (archiveModal) archiveModal.classList.remove('active');
    modal.classList.add('active');
  } else {
    // Fallback alert if modal not present
    let html = `${t.name} - ${typeLabel(t.type)}\n` + t.standings.map((s,i)=> `${i+1}. ${s.name} — ${s.points} נק'`).join('\n');
    alert(html);
  }
}

// ------------------ הגדרות ------------------
function onSaveSettings(e) {
  e.preventDefault();
  const win = parseInt(qs('#pointsWin').value,10);
  const mars = parseInt(qs('#pointsMars').value,10);
  if (win>0) data.settings.points.win = win;
  if (mars>0) data.settings.points.mars = mars;
  afterDataChange();
  alert('הגדרות נשמרו');
}

function loadSettingsForm() {
  const winEl = qs('#pointsWin');
  const marsEl = qs('#pointsMars');
  if (!winEl || !marsEl) return;
  winEl.value = data.settings.points.win;
  marsEl.value = data.settings.points.mars;
}

// ------------------ ייצוא ------------------
function exportStandings() {
  const t = data.tournaments.find(t=> t.id === data.activeTournamentId) || data.tournaments.find(t=>t.status==='completed' && t.id===data.activeTournamentId);
  if (!t) { alert('אין טורניר פעיל לייצוא'); return; }
  const stats = computeTournamentStats(t);
  const rows = Object.values(stats).sort((a,b)=>b.points - a.points || b.wins - a.wins);
  const win = data.settings.points.win; const mars = data.settings.points.mars;
  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>דוח טורניר</title>
    <style>body{font-family:system-ui,Arial;padding:2rem;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #999;padding:.4rem .6rem;}th{background:#eee;}h1{margin-top:0;}@media print{button{display:none;}}</style>
    </head><body>
    <button onclick="window.print()">הדפס</button>
    <h1>${t.name} - ${typeLabel(t.type)}</h1>
    <p>ניקוד: ניצחון=${win} | מרס=${mars}</p>
    <table><thead><tr><th>#</th><th>שם</th><th>נצחונות</th><th>הפסדים</th><th>מרסים</th><th>נקודות</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.marsWins}</td><td>${r.points}</td></tr>`).join('')}
    </tbody></table>
    </body></html>`;
  const w = window.open('about:blank','_blank');
  w.document.write(html);
  w.document.close();
}

// ------------------ רענון כללי ------------------
function refreshAll() {
  renderPlayers();
  renderPastTournaments();
  renderActiveTournament();
  loadSettingsForm();
}

function afterDataChange() {
  refreshAll();
  const exportBtn = qs('#btnExport'); if (exportBtn) exportBtn.disabled = !!data.activeTournamentId;
  // Try silent auto-save
  autoSaveIfPossible();
}

function handleTournamentCompletion(t) {
  console.log('handleTournamentCompletion called for tournament:', t);
  if (!t) return;
  computeStandings(t);
  t.status = 'completed';
  data.activeTournamentId = null;
  
  const winner = t.standings && t.standings.length > 0 ? t.standings[0] : null;
  console.log('Winner:', winner);
  if (winner) {
    console.log('Calling showWinnerModal');
    showWinnerModal(winner.name);
  }
  
  afterDataChange();
}

function closeActiveTournament() {
  const t = data.tournaments.find(t => t.id === data.activeTournamentId);
  if (!t) return;
  if (!confirm('לסיים את הטורניר?')) return;
  computeStandings(t);
  t.status='completed';
  data.activeTournamentId = null;
  afterDataChange();
}

function playerName(id) { return data.players[id]?.name || '???'; }

// חשיפה ל-debug
window._appData = () => data;

function showWinnerModal(winnerName, onModalClose) {
  console.log('showWinnerModal called with winner:', winnerName);
  const modal = qs('#winnerModal');
  const winnerNameEl = qs('#winnerName');
  if (!modal || !winnerNameEl) {
    console.error('Winner modal or winner name element not found');
    return;
  }

  winnerNameEl.textContent = winnerName;
  modal.classList.add('active');

  const canvas = qs('#confettiCanvas');
  const myConfetti = confetti.create(canvas, {
    resize: true,
    useWorker: true
  });
  myConfetti({
    particleCount: 200,
    spread: 180,
    origin: { y: 0.6 }
  });

  const closeBtn = qs('[data-action="close-winner"]');
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    if (onModalClose) {
      onModalClose();
    }
  }, { once: true });
}

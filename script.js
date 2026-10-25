/**
 * ============================================================================
 * RankFlow – Real-Time Leaderboard and Ranking Engine (JavaScript Implementation)
 * ============================================================================
 * 
 * DSA Core Structures:
 *   1. OrderStatisticAVLTree (Augmented Balanced BST with Subtree Sizes)
 *   2. IndexedMaxHeap (Binary Max-Heap with Index Hash Map)
 *   3. NaiveLeaderboard (Hash Map + Array Sort Baseline)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Record & Comparator
// ----------------------------------------------------------------------------
class UserRecord {
  constructor(userId, score, timestamp, avatar = '') {
    this.userId = userId;
    this.score = score;
    this.timestamp = timestamp;
    this.avatar = avatar;
    this.previousRank = null;
  }

  // Higher score first; tie breaker: earlier timestamp first; then userId
  isGreaterThan(other) {
    if (this.score !== other.score) return this.score > other.score;
    if (this.timestamp !== other.timestamp) return this.timestamp < other.timestamp;
    return this.userId < other.userId;
  }
}

// ============================================================================
// 1. Order Statistic AVL Tree Implementation
// ============================================================================
class AVLNode {
  constructor(record) {
    this.record = record;
    this.height = 1;
    this.subtreeSize = 1;
    this.left = null;
    this.right = null;
    this.parent = null;
  }
}

class OrderStatisticAVLTree {
  constructor() {
    this.root = null;
    this.userMap = new Map(); // userId -> AVLNode
  }

  size() {
    return this.root ? this.root.subtreeSize : 0;
  }

  getHeight(node) {
    return node ? node.height : 0;
  }

  getSize(node) {
    return node ? node.subtreeSize : 0;
  }

  updateNode(node) {
    if (!node) return;
    node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
    node.subtreeSize = 1 + this.getSize(node.left) + this.getSize(node.right);
  }

  getBalance(node) {
    return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0;
  }

  rotateRight(y) {
    const x = y.left;
    const T2 = x.right;
    const p = y.parent;

    x.right = y;
    y.parent = x;

    y.left = T2;
    if (T2) T2.parent = y;

    x.parent = p;
    if (p) {
      if (p.left === y) p.left = x;
      else p.right = x;
    } else {
      this.root = x;
    }

    this.updateNode(y);
    this.updateNode(x);
    return x;
  }

  rotateLeft(x) {
    const y = x.right;
    const T2 = y.left;
    const p = x.parent;

    y.left = x;
    x.parent = y;

    x.right = T2;
    if (T2) T2.parent = x;

    y.parent = p;
    if (p) {
      if (p.left === x) p.left = y;
      else p.right = y;
    } else {
      this.root = y;
    }

    this.updateNode(x);
    this.updateNode(y);
    return y;
  }

  rebalanceUpwards(curr) {
    while (curr) {
      this.updateNode(curr);
      const balance = this.getBalance(curr);

      if (balance > 1) {
        if (this.getBalance(curr.left) < 0) {
          this.rotateLeft(curr.left);
        }
        curr = this.rotateRight(curr);
      } else if (balance < -1) {
        if (this.getBalance(curr.right) > 0) {
          this.rotateRight(curr.right);
        }
        curr = this.rotateLeft(curr);
      }

      curr = curr.parent;
    }
  }

  insert(record) {
    const newNode = new AVLNode(record);
    this.userMap.set(record.userId, newNode);

    if (!this.root) {
      this.root = newNode;
      return;
    }

    let curr = this.root;
    let parent = null;

    while (curr) {
      parent = curr;
      // Higher score goes to LEFT child
      if (record.isGreaterThan(curr.record)) {
        curr = curr.left;
      } else {
        curr = curr.right;
      }
    }

    newNode.parent = parent;
    if (record.isGreaterThan(parent.record)) {
      parent.left = newNode;
    } else {
      parent.right = newNode;
    }

    this.rebalanceUpwards(parent);
  }

  removeNode(node) {
    if (!node) return;
    this.userMap.delete(node.record.userId);

    let nodeToBalance = null;

    if (!node.left || !node.right) {
      const child = node.left ? node.left : node.right;
      const p = node.parent;

      if (child) child.parent = p;

      if (!p) {
        this.root = child;
      } else if (p.left === node) {
        p.left = child;
      } else {
        p.right = child;
      }

      nodeToBalance = p;
    } else {
      // Find in-order successor (min in right subtree)
      let successor = node.right;
      while (successor.left) {
        successor = successor.left;
      }

      node.record = successor.record;
      this.userMap.set(node.record.userId, node);

      const succChild = successor.right;
      const succParent = successor.parent;

      if (succChild) succChild.parent = succParent;

      if (succParent.left === successor) {
        succParent.left = succChild;
      } else {
        succParent.right = succChild;
      }

      nodeToBalance = succParent;
    }

    this.rebalanceUpwards(nodeToBalance);
  }

  updateScore(userId, newScore, timestamp, avatar = '') {
    const existing = this.userMap.get(userId);
    let av = avatar;
    if (existing) {
      av = avatar || existing.record.avatar;
      this.removeNode(existing);
    }
    this.insert(new UserRecord(userId, newScore, timestamp, av));
  }

  getRecord(userId) {
    const node = this.userMap.get(userId);
    return node ? node.record : null;
  }

  // Exact 1-based rank query: O(log N)
  getRank(userId) {
    const node = this.userMap.get(userId);
    if (!node) return -1;

    let rank = this.getSize(node.left) + 1;
    let curr = node;

    while (curr.parent) {
      const p = curr.parent;
      if (p.right === curr) {
        rank += 1 + this.getSize(p.left);
      }
      curr = p;
    }
    return rank;
  }

  // Order statistic select: O(log N)
  getByRank(k) {
    if (k <= 0 || k > this.size()) return null;

    let curr = this.root;
    while (curr) {
      const leftCount = this.getSize(curr.left);
      if (k <= leftCount) {
        curr = curr.left;
      } else if (k === leftCount + 1) {
        return curr.record;
      } else {
        k -= (leftCount + 1);
        curr = curr.right;
      }
    }
    return null;
  }

  // Retrieve Top-K: O(K + log N)
  getTopK(k) {
    const result = [];
    const traverse = (node) => {
      if (!node || result.length >= k) return;
      traverse(node.left);
      if (result.length < k) {
        result.push(node.record);
        traverse(node.right);
      }
    };
    traverse(this.root);
    return result;
  }

  clear() {
    this.root = null;
    this.userMap.clear();
  }
}

// ============================================================================
// 2. Indexed Max-Heap Implementation
// ============================================================================
class IndexedMaxHeap {
  constructor() {
    this.heap = [];
    this.indexMap = new Map(); // userId -> array index
  }

  size() {
    return this.heap.length;
  }

  swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
    this.indexMap.set(this.heap[i].userId, i);
    this.indexMap.set(this.heap[j].userId, j);
  }

  siftUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[idx].isGreaterThan(this.heap[parent])) {
        this.swap(idx, parent);
        idx = parent;
      } else {
        break;
      }
    }
  }

  siftDown(idx) {
    const n = this.heap.length;
    while (true) {
      let largest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < n && this.heap[left].isGreaterThan(this.heap[largest])) {
        largest = left;
      }
      if (right < n && this.heap[right].isGreaterThan(this.heap[largest])) {
        largest = right;
      }

      if (largest !== idx) {
        this.swap(idx, largest);
        idx = largest;
      } else {
        break;
      }
    }
  }

  insert(record) {
    const idx = this.heap.length;
    this.heap.push(record);
    this.indexMap.set(record.userId, idx);
    this.siftUp(idx);
  }

  updateScore(userId, newScore, timestamp, avatar = '') {
    if (!this.indexMap.has(userId)) {
      this.insert(new UserRecord(userId, newScore, timestamp, avatar));
      return;
    }

    const idx = this.indexMap.get(userId);
    const oldRec = this.heap[idx];
    const newRec = new UserRecord(userId, newScore, timestamp, avatar || oldRec.avatar);
    this.heap[idx] = newRec;

    if (newRec.isGreaterThan(oldRec)) {
      this.siftUp(idx);
    } else {
      this.siftDown(idx);
    }
  }

  getTopK(k) {
    if (this.heap.length === 0 || k <= 0) return [];
    const limit = Math.min(k, this.heap.length);
    const result = [];

    // Min-heap tracking candidates
    const candidateIndices = [0];
    const comp = (a, b) => this.heap[b].isGreaterThan(this.heap[a]);

    for (let i = 0; i < limit && candidateIndices.length > 0; ++i) {
      let bestIdx = 0;
      for (let j = 1; j < candidateIndices.length; ++j) {
        if (this.heap[candidateIndices[j]].isGreaterThan(this.heap[candidateIndices[bestIdx]])) {
          bestIdx = j;
        }
      }
      const chosen = candidateIndices.splice(bestIdx, 1)[0];
      result.push(this.heap[chosen]);

      const left = 2 * chosen + 1;
      const right = 2 * chosen + 2;
      if (left < this.heap.length) candidateIndices.push(left);
      if (right < this.heap.length) candidateIndices.push(right);
    }
    return result;
  }

  // O(N) linear scan required for rank query
  getRank(userId) {
    if (!this.indexMap.has(userId)) return -1;
    const target = this.heap[this.indexMap.get(userId)];
    let countGreater = 0;
    for (let i = 0; i < this.heap.length; i++) {
      if (this.heap[i].isGreaterThan(target)) {
        countGreater++;
      }
    }
    return countGreater + 1;
  }

  clear() {
    this.heap = [];
    this.indexMap.clear();
  }
}

// ============================================================================
// 3. Naive Baseline (Map + Sort) Implementation
// ============================================================================
class NaiveLeaderboard {
  constructor() {
    this.userMap = new Map();
  }

  size() {
    return this.userMap.size;
  }

  updateScore(userId, newScore, timestamp, avatar = '') {
    const existing = this.userMap.get(userId);
    this.userMap.set(userId, new UserRecord(userId, newScore, timestamp, avatar || (existing ? existing.avatar : '')));
  }

  getTopK(k) {
    const arr = Array.from(this.userMap.values());
    arr.sort((a, b) => (b.isGreaterThan(a) ? 1 : -1));
    return arr.slice(0, k);
  }

  getRank(userId) {
    const target = this.userMap.get(userId);
    if (!target) return -1;
    let countGreater = 0;
    for (const record of this.userMap.values()) {
      if (record.isGreaterThan(target)) {
        countGreater++;
      }
    }
    return countGreater + 1;
  }

  clear() {
    this.userMap.clear();
  }
}

// ============================================================================
// Leaderboard Application Controller & Live Simulation Engine
// ============================================================================
class LeaderboardApp {
  constructor() {
    this.engineType = 'avl'; // 'avl', 'heap', 'naive'
    this.avlEngine = new OrderStatisticAVLTree();
    this.heapEngine = new IndexedMaxHeap();
    this.naiveEngine = new NaiveLeaderboard();

    this.activeEngine = this.avlEngine;

    this.timerTicks = 0;
    this.totalUpdates = 0;
    this.updateLog = []; // recent update activity
    this.historyExport = []; // audit log for CSV

    this.previousRanks = new Map(); // userId -> last known rank for rank change badges
    this.isRunning = false;
    this.simIntervalId = null;

    this.topKLimit = 10;
    this.updateSpeedMs = 500; // tick every 500ms
    this.updatesPerTick = 3;
    this.userCountTarget = 100;

    this.initDOM();
    this.seedInitialUsers(100);
    this.render();
  }

  getActiveEngine() {
    if (this.engineType === 'avl') return this.avlEngine;
    if (this.engineType === 'heap') return this.heapEngine;
    return this.naiveEngine;
  }

  seedInitialUsers(count) {
    const firstNames = [
      'Alex', 'Blake', 'Casey', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Ian', 'Julia',
      'Kevin', 'Luna', 'Marcus', 'Nora', 'Oliver', 'Penny', 'Quinn', 'Riley', 'Sam', 'Tara',
      'Uma', 'Victor', 'Wendy', 'Xander', 'Yara', 'Zack', 'Aria', 'Boris', 'Chloe', 'Dylan'
    ];

    const avatars = ['🎮', '⚡', '🚀', '🔥', '👑', '🎯', '💎', '🛡️', '⚔️', '🌟', '🦄', '🦁', '🦊', '🐺', '🐉'];

    this.avlEngine.clear();
    this.heapEngine.clear();
    this.naiveEngine.clear();
    this.previousRanks.clear();
    this.totalUpdates = 0;
    this.updateLog = [];

    const baseScores = [];
    for (let i = 1; i <= count; i++) {
      const name = firstNames[(i - 1) % firstNames.length] + '_' + (100 + i);
      const score = Math.floor(1000 + Math.random() * 8900);
      const avatar = avatars[i % avatars.length];
      baseScores.push({ id: name, score, avatar });
    }

    // Sort to assign realistic initial ranks
    baseScores.sort((a, b) => b.score - a.score);

    baseScores.forEach((item, index) => {
      const rec = new UserRecord(item.id, item.score, index + 1, item.avatar);
      this.avlEngine.insert(rec);
      this.heapEngine.insert(rec);
      this.naiveEngine.updateScore(item.id, item.score, index + 1, item.avatar);
      this.previousRanks.set(item.id, index + 1);
    });

    this.userCountTarget = count;
    this.logActivity(`Initialized leaderboard with ${count} competitive players.`);
  }

  initDOM() {
    // Header Buttons
    this.btnStart = document.getElementById('btnStart');
    this.btnPause = document.getElementById('btnPause');
    this.btnReset = document.getElementById('btnReset');
    this.badgeStatus = document.getElementById('simStatusBadge');
    this.timerDisplay = document.getElementById('timerDisplay');

    this.btnStart.addEventListener('click', () => this.startSimulation());
    this.btnPause.addEventListener('click', () => this.pauseSimulation());
    this.btnReset.addEventListener('click', () => this.resetSimulation());

    // Settings
    this.selectEngine = document.getElementById('selectEngine');
    this.selectSpeed = document.getElementById('selectSpeed');
    this.selectTopK = document.getElementById('selectTopK');
    this.selectUserCount = document.getElementById('selectUserCount');
    this.btnApplySettings = document.getElementById('btnApplySettings');

    this.selectEngine.addEventListener('change', (e) => {
      this.engineType = e.target.value;
      this.updateEngineBadge();
      this.render();
      this.logActivity(`Switched active engine to: ${this.getEngineName(this.engineType)}`);
    });

    this.selectSpeed.addEventListener('change', (e) => {
      this.setSpeed(e.target.value);
    });

    this.selectTopK.addEventListener('change', (e) => {
      this.topKLimit = parseInt(e.target.value, 10);
      this.renderLeaderboard();
    });

    this.selectUserCount.addEventListener('change', (e) => {
      const count = parseInt(e.target.value, 10);
      this.seedInitialUsers(count);
      this.render();
    });

    // Manual Score Update Form
    this.formUpdateScore = document.getElementById('formUpdateScore');
    this.inputUserId = document.getElementById('inputUserId');
    this.inputScoreDelta = document.getElementById('inputScoreDelta');
    this.selectUpdateType = document.getElementById('selectUpdateType');

    this.formUpdateScore.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleManualScoreUpdate();
    });

    // Auto injection buttons
    document.getElementById('btnInject1').addEventListener('click', () => this.injectRandomUpdates(1));
    document.getElementById('btnInject10').addEventListener('click', () => this.injectRandomUpdates(10));
    document.getElementById('btnInject50').addEventListener('click', () => this.injectRandomUpdates(50));

    // Query User Rank Form
    this.formQueryRank = document.getElementById('formQueryRank');
    this.inputQueryUser = document.getElementById('inputQueryUser');
    this.rankResultCard = document.getElementById('rankResultCard');

    this.formQueryRank.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleQueryRank();
    });

    // Query By Rank Form
    this.formQueryByRank = document.getElementById('formQueryByRank');
    this.inputQueryRankNum = document.getElementById('inputQueryRankNum');
    this.byRankResultCard = document.getElementById('byRankResultCard');

    this.formQueryByRank.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleQueryByRank();
    });

    // Benchmark Suite
    this.btnRunBenchmark = document.getElementById('btnRunBenchmark');
    this.btnRunBenchmark.addEventListener('click', () => this.runInteractiveBenchmark());

    // Export Buttons
    this.btnExportCSV = document.getElementById('btnExportCSV');
    this.btnClearLog = document.getElementById('btnClearLog');

    this.btnExportCSV.addEventListener('click', () => this.exportLeaderboardCSV());
    this.btnClearLog.addEventListener('click', () => {
      this.updateLog = [];
      this.renderActivityLog();
    });
  }

  setSpeed(speedVal) {
    if (speedVal === 'slow') {
      this.updateSpeedMs = 1000;
      this.updatesPerTick = 1;
    } else if (speedVal === 'medium') {
      this.updateSpeedMs = 500;
      this.updatesPerTick = 3;
    } else if (speedVal === 'fast') {
      this.updateSpeedMs = 200;
      this.updatesPerTick = 8;
    } else if (speedVal === 'hyper') {
      this.updateSpeedMs = 80;
      this.updatesPerTick = 15;
    }

    if (this.isRunning) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = setInterval(() => this.simulationTick(), this.updateSpeedMs);
    }
  }

  startSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.badgeStatus.textContent = 'Live Updating';
    this.badgeStatus.className = 'badge badge-available';
    this.btnStart.disabled = true;
    this.btnPause.disabled = false;

    this.simIntervalId = setInterval(() => this.simulationTick(), this.updateSpeedMs);
  }

  pauseSimulation() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.simIntervalId);
    this.badgeStatus.textContent = 'Paused';
    this.badgeStatus.className = 'badge badge-paused';
    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
  }

  resetSimulation() {
    this.pauseSimulation();
    this.timerTicks = 0;
    this.badgeStatus.textContent = 'Stopped';
    this.badgeStatus.className = 'badge badge-stopped';
    this.timerDisplay.textContent = 'Updates: 0';
    this.seedInitialUsers(this.userCountTarget);
    this.render();
  }

  simulationTick() {
    this.timerTicks++;
    this.injectRandomUpdates(this.updatesPerTick, true);
    this.timerDisplay.textContent = `Updates: ${this.totalUpdates}`;
    this.render();
  }

  injectRandomUpdates(count, isLiveTick = false) {
    const engine = this.getActiveEngine();
    const currentTop = engine.getTopK(this.userCountTarget);
    if (!currentTop || currentTop.length === 0) return;

    for (let i = 0; i < count; i++) {
      // Pick a random user (favoring middle and top players)
      const userIdx = Math.floor(Math.pow(Math.random(), 1.4) * currentTop.length);
      const user = currentTop[userIdx];
      if (!user) continue;

      const oldRank = engine.getRank(user.userId);
      // Volatile score gain: +50 to +800 pts
      const delta = Math.floor(50 + Math.random() * 750);
      const newScore = user.score + delta;
      const timestamp = Date.now() + i;

      // Update all 3 engines to keep them synchronized
      this.avlEngine.updateScore(user.userId, newScore, timestamp, user.avatar);
      this.heapEngine.updateScore(user.userId, newScore, timestamp, user.avatar);
      this.naiveEngine.updateScore(user.userId, newScore, timestamp, user.avatar);

      this.totalUpdates++;
      const newRank = engine.getRank(user.userId);

      const rankDelta = oldRank - newRank; // positive means climbed up!
      let logMsg = `${user.avatar} <strong>${user.userId}</strong> scored +${delta} pts (Score: ${newScore.toLocaleString()})`;
      if (rankDelta > 0) {
        logMsg += ` <span class="badge-climbed">↑ climbed ${rankDelta} spots to #${newRank}</span>`;
      } else if (rankDelta < 0) {
        logMsg += ` <span class="badge-fell">↓ slipped ${Math.abs(rankDelta)} spots to #${newRank}</span>`;
      } else {
        logMsg += ` (held #${newRank})`;
      }

      this.updateLog.unshift({
        time: new Date().toLocaleTimeString(),
        text: logMsg,
        userId: user.userId,
        newRank: newRank,
        rankDelta: rankDelta
      });

      if (this.updateLog.length > 50) this.updateLog.pop();

      // Record in audit log
      this.historyExport.push({
        time: new Date().toISOString(),
        userId: user.userId,
        scoreDelta: delta,
        newScore: newScore,
        oldRank: oldRank,
        newRank: newRank
      });
    }

    if (!isLiveTick) {
      this.render();
      this.timerDisplay.textContent = `Updates: ${this.totalUpdates}`;
    }
  }

  handleManualScoreUpdate() {
    const userId = this.inputUserId.value.trim();
    const rawVal = parseInt(this.inputScoreDelta.value, 10);
    const updateType = this.selectUpdateType.value; // 'add' or 'set'

    if (!userId || isNaN(rawVal)) {
      this.showAlert('Please provide a valid User ID and Score Value.', 'warning');
      return;
    }

    const engine = this.getActiveEngine();
    const existing = this.avlEngine.getRecord(userId);
    const oldScore = existing ? existing.score : 0;
    const oldRank = existing ? engine.getRank(userId) : -1;

    let newScore = rawVal;
    if (updateType === 'add') {
      newScore = Math.max(0, oldScore + rawVal);
    }

    const timestamp = Date.now();
    const avatar = existing ? existing.avatar : '👤';

    this.avlEngine.updateScore(userId, newScore, timestamp, avatar);
    this.heapEngine.updateScore(userId, newScore, timestamp, avatar);
    this.naiveEngine.updateScore(userId, newScore, timestamp, avatar);

    this.totalUpdates++;
    const newRank = engine.getRank(userId);

    this.showAlert(`Updated ${userId}: Score is now ${newScore.toLocaleString()} (Rank #${newRank})`, 'success');
    this.logActivity(`Manual Update: ${userId} set to ${newScore.toLocaleString()} (Rank #${newRank})`);
    this.render();
  }

  handleQueryRank() {
    const userId = this.inputQueryUser.value.trim();
    if (!userId) return;

    const engine = this.getActiveEngine();
    const startTime = performance.now();
    const rank = engine.getRank(userId);
    const elapsedMicros = ((performance.now() - startTime) * 1000).toFixed(2);

    const record = this.avlEngine.getRecord(userId);

    if (rank === -1 || !record) {
      this.rankResultCard.innerHTML = `
        <div class="query-not-found">
          User <strong>"${userId}"</strong> was not found on the leaderboard.
        </div>
      `;
      return;
    }

    const totalUsers = engine.size();
    const percentile = (((totalUsers - rank) / totalUsers) * 100).toFixed(1);

    // Get neighborhood: 2 above, 2 below
    const neighborhoodHtml = this.getNeighborhoodHtml(rank);

    this.rankResultCard.innerHTML = `
      <div class="query-card-content">
        <div class="query-card-header">
          <div class="user-pill">
            <span class="user-avatar">${record.avatar}</span>
            <span class="user-name">${record.userId}</span>
          </div>
          <span class="rank-badge rank-pill-${rank <= 3 ? rank : 'regular'}">Rank #${rank}</span>
        </div>
        <div class="query-stats-row">
          <div><span class="label">Current Score:</span> <strong>${record.score.toLocaleString()}</strong></div>
          <div><span class="label">Percentile:</span> <strong>Top ${100 - percentile}%</strong></div>
          <div><span class="label">Query Latency:</span> <strong>${elapsedMicros} µs</strong></div>
        </div>
        <div class="neighborhood-container">
          <span class="neighborhood-title">Surrounding Ranks:</span>
          ${neighborhoodHtml}
        </div>
      </div>
    `;
  }

  getNeighborhoodHtml(centerRank) {
    const engine = this.getActiveEngine();
    const start = Math.max(1, centerRank - 2);
    const end = Math.min(engine.size(), centerRank + 2);
    let html = '<div class="neighborhood-chips">';
    for (let r = start; r <= end; r++) {
      const rec = this.avlEngine.getByRank(r);
      if (rec) {
        const isTarget = r === centerRank;
        html += `
          <div class="chip ${isTarget ? 'chip-target' : ''}">
            <span class="chip-rank">#${r}</span>
            <span class="chip-user">${rec.avatar} ${rec.userId}</span>
            <span class="chip-score">${rec.score.toLocaleString()}</span>
          </div>
        `;
      }
    }
    html += '</div>';
    return html;
  }

  handleQueryByRank() {
    const rankNum = parseInt(this.inputQueryRankNum.value, 10);
    const engine = this.getActiveEngine();

    if (isNaN(rankNum) || rankNum <= 0 || rankNum > engine.size()) {
      this.byRankResultCard.innerHTML = `
        <div class="query-not-found">
          Rank #${rankNum} is out of bounds (Current range: 1 to ${engine.size()}).
        </div>
      `;
      return;
    }

    const startTime = performance.now();
    // Order statistic select query
    const record = this.avlEngine.getByRank(rankNum);
    const elapsedMicros = ((performance.now() - startTime) * 1000).toFixed(2);

    if (!record) {
      this.byRankResultCard.innerHTML = `<div class="query-not-found">No user at rank #${rankNum}</div>`;
      return;
    }

    this.byRankResultCard.innerHTML = `
      <div class="query-card-content">
        <div class="query-card-header">
          <div class="user-pill">
            <span class="user-avatar">${record.avatar}</span>
            <span class="user-name">${record.userId}</span>
          </div>
          <span class="rank-badge rank-pill-${rankNum <= 3 ? rankNum : 'regular'}">Rank #${rankNum}</span>
        </div>
        <div class="query-stats-row">
          <div><span class="label">Score:</span> <strong>${record.score.toLocaleString()}</strong></div>
          <div><span class="label">Select Time:</span> <strong>${elapsedMicros} µs</strong></div>
          <div><span class="label">DSA Operation:</span> <code>Order Statistic Select O(log N)</code></div>
        </div>
      </div>
    `;
  }

  // Run in-browser benchmark comparison across the 3 data structures
  runInteractiveBenchmark() {
    const btn = this.btnRunBenchmark;
    btn.disabled = true;
    btn.textContent = 'Running Benchmark (please wait)...';

    const testUsers = 2000;
    const testUpdates = 10000;
    const testTopK = 10;
    const testQueries = 500;

    setTimeout(() => {
      // 1. Prepare identical update workload
      const updates = [];
      for (let i = 0; i < testUpdates; i++) {
        updates.push({
          userId: `User_${1 + Math.floor(Math.random() * testUsers)}`,
          score: Math.floor(100 + Math.random() * 50000),
          timestamp: i + 1
        });
      }

      const queryUsers = [];
      for (let i = 0; i < testQueries; i++) {
        queryUsers.push(`User_${1 + Math.floor(Math.random() * testUsers)}`);
      }

      // --- Benchmark 1: AVL Tree ---
      const benchAvl = new OrderStatisticAVLTree();
      for (let i = 1; i <= testUsers; i++) {
        benchAvl.insert(new UserRecord(`User_${i}`, 100, 0));
      }

      let t0 = performance.now();
      for (const op of updates) {
        benchAvl.updateScore(op.userId, op.score, op.timestamp);
      }
      const avlUpdateMs = performance.now() - t0;

      t0 = performance.now();
      for (let q = 0; q < 50; q++) {
        benchAvl.getTopK(testTopK);
      }
      const avlTopKMs = (performance.now() - t0) / 50;

      t0 = performance.now();
      for (const u of queryUsers) {
        benchAvl.getRank(u);
      }
      const avlRankMs = performance.now() - t0;

      // --- Benchmark 2: Indexed Max-Heap ---
      const benchHeap = new IndexedMaxHeap();
      for (let i = 1; i <= testUsers; i++) {
        benchHeap.insert(new UserRecord(`User_${i}`, 100, 0));
      }

      t0 = performance.now();
      for (const op of updates) {
        benchHeap.updateScore(op.userId, op.score, op.timestamp);
      }
      const heapUpdateMs = performance.now() - t0;

      t0 = performance.now();
      for (let q = 0; q < 50; q++) {
        benchHeap.getTopK(testTopK);
      }
      const heapTopKMs = (performance.now() - t0) / 50;

      t0 = performance.now();
      for (const u of queryUsers) {
        benchHeap.getRank(u);
      }
      const heapRankMs = performance.now() - t0;

      // --- Benchmark 3: Naive Map + Sort ---
      const benchNaive = new NaiveLeaderboard();
      for (let i = 1; i <= testUsers; i++) {
        benchNaive.updateScore(`User_${i}`, 100, 0);
      }

      t0 = performance.now();
      for (const op of updates) {
        benchNaive.updateScore(op.userId, op.score, op.timestamp);
      }
      const naiveUpdateMs = performance.now() - t0;

      t0 = performance.now();
      for (let q = 0; q < 50; q++) {
        benchNaive.getTopK(testTopK);
      }
      const naiveTopKMs = (performance.now() - t0) / 50;

      t0 = performance.now();
      for (const u of queryUsers) {
        benchNaive.getRank(u);
      }
      const naiveRankMs = performance.now() - t0;

      // Render results in table
      const tbody = document.getElementById('benchmarkTableBody');
      tbody.innerHTML = `
        <tr class="highlight-row">
          <td><strong>Order Statistic AVL Tree</strong></td>
          <td><span class="badge badge-success">${avlUpdateMs.toFixed(1)} ms</span></td>
          <td>${(avlUpdateMs * 1000 / testUpdates).toFixed(2)} µs</td>
          <td><span class="badge badge-success">${avlTopKMs.toFixed(2)} ms</span></td>
          <td><span class="badge badge-success">${avlRankMs.toFixed(1)} ms</span></td>
          <td><code>O(log N)</code></td>
          <td><code>O(log N)</code></td>
        </tr>
        <tr>
          <td><strong>Indexed Max-Heap</strong></td>
          <td><span class="badge badge-available">${heapUpdateMs.toFixed(1)} ms</span></td>
          <td>${(heapUpdateMs * 1000 / testUpdates).toFixed(2)} µs</td>
          <td><span class="badge badge-available">${heapTopKMs.toFixed(2)} ms</span></td>
          <td><span class="badge badge-danger">${heapRankMs.toFixed(1)} ms</span></td>
          <td><code>O(log N)</code></td>
          <td><code class="text-danger">O(N) [Slow]</code></td>
        </tr>
        <tr>
          <td><strong>Naive Map + Array Sort</strong></td>
          <td><span class="badge badge-stopped">${naiveUpdateMs.toFixed(1)} ms</span></td>
          <td>${(naiveUpdateMs * 1000 / testUpdates).toFixed(2)} µs</td>
          <td><span class="badge badge-danger">${naiveTopKMs.toFixed(2)} ms</span></td>
          <td><span class="badge badge-danger">${naiveRankMs.toFixed(1)} ms</span></td>
          <td><code>O(1)</code></td>
          <td><code class="text-danger">O(N) [Slow]</code></td>
        </tr>
      `;

      btn.disabled = false;
      btn.textContent = 'Re-Run Comparison Benchmark';
      this.showAlert(`Benchmark complete: 10,000 updates evaluated! Order Statistic Tree dominated rank queries.`, 'success');
    }, 40);
  }

  exportLeaderboardCSV() {
    const engine = this.getActiveEngine();
    const allUsers = engine.getTopK(engine.size());
    if (!allUsers || allUsers.length === 0) {
      this.showAlert('No leaderboard data to export.', 'warning');
      return;
    }

    let csv = 'Rank,User_ID,Score,Last_Updated_ISO\n';
    allUsers.forEach((user, index) => {
      csv += `${index + 1},"${user.userId}",${user.score},"${new Date(user.timestamp).toISOString()}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rankflow_leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showAlert('Leaderboard exported successfully as CSV.', 'success');
  }

  showAlert(message, type = 'info') {
    const alertBox = document.getElementById('feedbackAlert');
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove('hidden');
    setTimeout(() => {
      alertBox.classList.add('hidden');
    }, 4500);
  }

  logActivity(text) {
    this.updateLog.unshift({
      time: new Date().toLocaleTimeString(),
      text: text,
      rankDelta: 0
    });
    if (this.updateLog.length > 50) this.updateLog.pop();
    this.renderActivityLog();
  }

  updateEngineBadge() {
    const badge = document.getElementById('activeEngineNotice');
    badge.textContent = `Active Engine: ${this.getEngineName(this.engineType)}`;
    const complexityEl = document.getElementById('statComplexity');
    if (this.engineType === 'avl') {
      complexityEl.innerHTML = `<code>O(log N)</code> Upd &bull; <code>O(log N)</code> Rank`;
    } else if (this.engineType === 'heap') {
      complexityEl.innerHTML = `<code>O(log N)</code> Upd &bull; <code class="text-danger">O(N)</code> Rank`;
    } else {
      complexityEl.innerHTML = `<code>O(1)</code> Upd &bull; <code class="text-danger">O(N)</code> Rank`;
    }
  }

  getEngineName(type) {
    if (type === 'avl') return 'Order Statistic AVL Tree (Augmented BST)';
    if (type === 'heap') return 'Indexed Max-Heap + Hash Map';
    return 'Naive Map + Array Sort';
  }

  render() {
    this.renderLeaderboard();
    this.renderStats();
    this.renderActivityLog();
  }

  renderLeaderboard() {
    const engine = this.getActiveEngine();
    const topRecords = engine.getTopK(this.topKLimit);
    const tbody = document.getElementById('leaderboardTableBody');
    const badge = document.getElementById('leaderboardCountBadge');

    badge.textContent = `Top ${this.topKLimit} of ${engine.size()} users`;

    if (!topRecords || topRecords.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No players currently on leaderboard.</td></tr>`;
      return;
    }

    const maxScore = topRecords[0].score || 1;

    let html = '';
    topRecords.forEach((user, index) => {
      const currentRank = index + 1;
      const prevRank = this.previousRanks.get(user.userId);
      this.previousRanks.set(user.userId, currentRank);

      let deltaBadge = '<span class="rank-neutral">-</span>';
      if (prevRank !== undefined) {
        if (prevRank > currentRank) {
          deltaBadge = `<span class="rank-up" title="Climbed from #${prevRank}">↑ ${prevRank - currentRank}</span>`;
        } else if (prevRank < currentRank) {
          deltaBadge = `<span class="rank-down" title="Fell from #${prevRank}">↓ ${currentRank - prevRank}</span>`;
        }
      }

      let rankClass = 'rank-regular';
      let medalIcon = `#${currentRank}`;
      if (currentRank === 1) {
        rankClass = 'rank-gold';
        medalIcon = '🥇 1';
      } else if (currentRank === 2) {
        rankClass = 'rank-silver';
        medalIcon = '🥈 2';
      } else if (currentRank === 3) {
        rankClass = 'rank-bronze';
        medalIcon = '🥉 3';
      }

      const barWidth = Math.max(8, Math.min(100, Math.round((user.score / maxScore) * 100)));

      html += `
        <tr class="${currentRank <= 3 ? 'top-podium-row' : ''}">
          <td class="col-rank">
            <span class="rank-pill ${rankClass}">${medalIcon}</span>
          </td>
          <td class="col-user">
            <div class="user-cell">
              <span class="user-avatar">${user.avatar || '👤'}</span>
              <span class="user-name">${user.userId}</span>
            </div>
          </td>
          <td class="col-score">
            <div class="score-container">
              <span class="score-number">${user.score.toLocaleString()}</span>
              <div class="score-bar-bg">
                <div class="score-bar-fill" style="width: ${barWidth}%"></div>
              </div>
            </div>
          </td>
          <td class="col-delta">${deltaBadge}</td>
          <td class="col-time">${new Date(user.timestamp).toLocaleTimeString()}</td>
          <td class="col-action">
            <button class="btn btn-outline btn-xs" onclick="window.app.quickAddScore('${user.userId}', 150)">+150 pts</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  quickAddScore(userId, delta) {
    const existing = this.avlEngine.getRecord(userId);
    if (!existing) return;
    const newScore = existing.score + delta;
    const timestamp = Date.now();

    this.avlEngine.updateScore(userId, newScore, timestamp, existing.avatar);
    this.heapEngine.updateScore(userId, newScore, timestamp, existing.avatar);
    this.naiveEngine.updateScore(userId, newScore, timestamp, existing.avatar);

    this.totalUpdates++;
    this.render();
    this.logActivity(`Quick Boost: ${existing.avatar} ${userId} +${delta} pts!`);
  }

  renderStats() {
    const engine = this.getActiveEngine();
    const size = engine.size();
    const top1 = engine.getTopK(1);

    document.getElementById('statTotalUsers').textContent = size.toLocaleString();
    document.getElementById('statTotalUpdates').textContent = this.totalUpdates.toLocaleString();

    if (top1 && top1.length > 0) {
      document.getElementById('statLeader').innerHTML = `${top1[0].avatar} <strong>${top1[0].userId}</strong> (${top1[0].score.toLocaleString()})`;
    } else {
      document.getElementById('statLeader').textContent = 'None';
    }

    // Theoretical log2(N) tree depth
    const theoreticalDepth = size > 0 ? Math.ceil(Math.log2(size)) : 0;
    const actualHeight = this.avlEngine.getHeight(this.avlEngine.root);
    document.getElementById('statTreeDepth').textContent = `${actualHeight} (log₂ N: ${theoreticalDepth})`;

    // Calculate average score across sample
    const sample = engine.getTopK(Math.min(size, 100));
    let sum = 0;
    sample.forEach(s => sum += s.score);
    const avg = sample.length > 0 ? Math.round(sum / sample.length) : 0;
    document.getElementById('statAvgScore').textContent = avg.toLocaleString();

    this.updateEngineBadge();
  }

  renderActivityLog() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    if (this.updateLog.length === 0) {
      container.innerHTML = `<div class="empty-log">No recent update activities recorded.</div>`;
      return;
    }

    let html = '';
    this.updateLog.slice(0, 15).forEach(item => {
      html += `
        <div class="log-item">
          <span class="log-time">${item.time}</span>
          <span class="log-text">${item.text}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.app = new LeaderboardApp();
});

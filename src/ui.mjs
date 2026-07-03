import {
  BOARD_COLS,
  BOARD_ROWS,
  applyAction,
  applySurrender,
  createInitialState,
  getActionEffects,
  getActionPreview,
  getCombinations,
  getLegalActions,
  getPieceAt,
  getProtectedPieceIds,
  isBlocked,
  isOwnPalace,
  opponentOf,
} from "./game.mjs";
import { chooseAiAction } from "./ai.mjs";
import { loadGameConfig } from "./config.mjs";
import { loadBoardGamesCoreClient } from "./online-core-loader.mjs";
import { seatedPeers, sideForPeer } from "./online-seats.mjs";
import { createSocialEntry } from "./online-social.mjs";
import {
  comboNames,
  comboSourceLabel,
  coord,
  formatActionLabel,
  formatActionTags,
  fullPieceNames,
  getPieceLabel,
  pieceNames,
  sideNames,
} from "./labels.mjs";

const homeViewEl = document.querySelector("#homeView");
const setupViewEl = document.querySelector("#setupView");
const onlineViewEl = document.querySelector("#onlineView");
const gameViewEl = document.querySelector("#gameView");
const localModeBtn = document.querySelector("#localModeBtn");
const aiModeBtn = document.querySelector("#aiModeBtn");
const onlineModeBtn = document.querySelector("#onlineModeBtn");
const setupBackBtn = document.querySelector("#setupBackBtn");
const chooseNorthBtn = document.querySelector("#chooseNorthBtn");
const chooseSouthBtn = document.querySelector("#chooseSouthBtn");
const onlineBackBtn = document.querySelector("#onlineBackBtn");
const createOnlineRoomBtn = document.querySelector("#createOnlineRoomBtn");
const joinOnlineRoomBtn = document.querySelector("#joinOnlineRoomBtn");
const onlineNameInput = document.querySelector("#onlineNameInput");
const roomCodeInput = document.querySelector("#roomCodeInput");
const onlineStatusEl = document.querySelector("#onlineStatus");
const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const modeLabelEl = document.querySelector("#modeLabel");
const selectedInfoEl = document.querySelector("#selectedInfo");
const actionsEl = document.querySelector("#actions");
const combosEl = document.querySelector("#combos");
const onlineSocialPanelEl = document.querySelector("#onlineSocialPanel");
const socialNoticeEl = document.querySelector("#socialNotice");
const socialFlashEl = document.querySelector("#socialFlash");
const socialPhraseToggleBtn = document.querySelector("#socialPhraseToggle");
const socialEmojiToggleBtn = document.querySelector("#socialEmojiToggle");
const socialTrayEl = document.querySelector("#socialTray");
const socialTrayActionsEl = document.querySelector("#socialTrayActions");
const moveLogEl = document.querySelector("#moveLog");
const homeBtn = document.querySelector("#homeBtn");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");
const surrenderBtn = document.querySelector("#surrenderBtn");

let appView = "home";
let gameMode = "local";
let humanSide = null;
let aiSide = null;
let aiThinking = false;
let aiTimer = null;
let onlineClient = null;
let onlineSide = null;
let onlineRoom = null;
let onlineConnected = false;
let onlineOpenPeerIds = new Set();
let socialPhrases = [];
let socialEmojis = [];
let socialCatalogLoading = false;
let socialCatalogDiagnostics = [];
let socialFlashEntry = null;
let socialFlashTimer = null;
let socialTrayMode = null;
let state = createInitialState();
let selectedPieceId = null;
let selectedSourceId = null;
let history = [];
let moveLog = [];
let warningMessage = "";
let previewAction = null;
let gameConfig = null;
let gameConfigError = null;
let boardGamesCoreClientClass = null;

try {
  gameConfig = await loadGameConfig();
} catch (error) {
  gameConfigError = error;
}

function setView(view) {
  appView = view;
  homeViewEl.classList.toggle("hidden", view !== "home");
  setupViewEl.classList.toggle("hidden", view !== "setup");
  onlineViewEl.classList.toggle("hidden", view !== "online");
  gameViewEl.classList.toggle("hidden", view !== "game");
}

function clearAiTimer() {
  if (!aiTimer) return;
  clearTimeout(aiTimer);
  aiTimer = null;
}

function clearSocialFlashTimer() {
  if (!socialFlashTimer) return;
  clearTimeout(socialFlashTimer);
  socialFlashTimer = null;
}

function resetMatchState() {
  clearAiTimer();
  state = createInitialState();
  selectedPieceId = null;
  selectedSourceId = null;
  warningMessage = "";
  previewAction = null;
  history = [];
  moveLog = [];
  aiThinking = false;
}

function cleanupOnlineClient() {
  onlineClient?.close();
  onlineClient = null;
  onlineSide = null;
  onlineRoom = null;
  onlineConnected = false;
  onlineOpenPeerIds = new Set();
  socialPhrases = [];
  socialEmojis = [];
  socialCatalogLoading = false;
  socialCatalogDiagnostics = [];
  socialFlashEntry = null;
  socialTrayMode = null;
  clearSocialFlashTimer();
}

function startLocalGame() {
  cleanupOnlineClient();
  gameMode = "local";
  humanSide = null;
  aiSide = null;
  resetMatchState();
  setView("game");
  render();
}

function showAiSetup() {
  cleanupOnlineClient();
  clearAiTimer();
  setView("setup");
}

function showOnlineSetup() {
  clearAiTimer();
  cleanupOnlineClient();
  const onlineAvailable = Boolean(getSignalingUrl());
  createOnlineRoomBtn.disabled = !onlineAvailable;
  joinOnlineRoomBtn.disabled = !onlineAvailable;
  onlineStatusEl.textContent = onlineAvailable
    ? "创建或加入一个私有朋友局。"
    : `在线配置不可用：${gameConfigError?.message ?? "缺少信令地址"}`;
  setView("online");
}

function startAiGame(playerSide) {
  cleanupOnlineClient();
  gameMode = "ai";
  humanSide = playerSide;
  aiSide = opponentOf(playerSide);
  resetMatchState();
  setView("game");
  render();
  scheduleAiTurnIfNeeded();
}

function goHome() {
  clearAiTimer();
  cleanupOnlineClient();
  aiThinking = false;
  selectedPieceId = null;
  selectedSourceId = null;
  previewAction = null;
  warningMessage = "";
  setView("home");
}

function isAiGame() {
  return gameMode === "ai";
}

function isOnlineGame() {
  return gameMode === "online";
}

function getSignalingUrl() {
  return gameConfig?.online?.signalingUrl ?? "";
}

async function getBoardGamesCoreClientClass() {
  if (!boardGamesCoreClientClass) {
    boardGamesCoreClientClass = await loadBoardGamesCoreClient({ gameConfig });
  }
  return boardGamesCoreClientClass;
}

function connectedOnlinePlayers() {
  return seatedPeers(onlineRoom);
}

function hasOpenChannelsToOnlinePlayers() {
  return connectedOnlinePlayers()
    .filter((peer) => peer.id !== onlineClient?.peerId)
    .every((peer) => onlineOpenPeerIds.has(peer.id));
}

function onlineWaitMessage() {
  if (!isOnlineGame()) return "";
  if (connectedOnlinePlayers().length < 2) return "等待对手加入";
  if (!hasOpenChannelsToOnlinePlayers()) return "正在建立P2P连接";
  return "";
}

function isOnlineReady() {
  return isOnlineGame() && !onlineWaitMessage();
}

function isAiTurn() {
  return isAiGame() && !state.winner && state.turn === aiSide;
}

function isHumanTurn() {
  if (isOnlineGame()) return onlineConnected && isOnlineReady() && state.turn === onlineSide;
  return !isAiGame() || state.turn === humanSide;
}

function onlineSnapshot() {
  return {
    state,
    moveLog: [...moveLog],
  };
}

function restoreOnlineSnapshot(snapshot) {
  if (!snapshot?.state) return;
  state = snapshot.state;
  moveLog = [...(snapshot.moveLog ?? [])];
  selectedPieceId = null;
  selectedSourceId = null;
  previewAction = null;
  warningMessage = "";
  render();
}

function attachOnlineClient(client) {
  onlineClient = client;
  client.setSnapshotProvider(onlineSnapshot);

  client.addEventListener("room-created", (event) => adoptOnlineRoom(event.detail.room));
  client.addEventListener("room-joined", (event) => adoptOnlineRoom(event.detail.room));
  client.addEventListener("room-resumed", (event) => adoptOnlineRoom(event.detail.room));
  client.addEventListener("peer-joined", (event) => {
    adoptOnlineRoom(event.detail.room);
    warningMessage = "对手已加入";
    render();
  });
  client.addEventListener("peer-left", (event) => {
    onlineOpenPeerIds.delete(event.detail.peerId);
    if (event.detail.room) adoptOnlineRoom(event.detail.room);
    warningMessage = `玩家掉线：${event.detail.peerId}`;
    render();
  });
  client.addEventListener("peer-channel-open", (event) => {
    onlineOpenPeerIds.add(event.detail.peerId);
    warningMessage = "";
    render();
  });
  client.addEventListener("peer-channel-close", (event) => {
    onlineOpenPeerIds.delete(event.detail.peerId);
    warningMessage = "P2P连接已断开";
    render();
  });
  client.addEventListener("host-changed", (event) => {
    if (event.detail.room) adoptOnlineRoom(event.detail.room);
    warningMessage = client.isHost ? "你已接管房间" : "房主已迁移";
    render();
  });
  client.addEventListener("snapshot", (event) => restoreOnlineSnapshot(event.detail.snapshot));
  client.addEventListener("game-message", (event) => handleOnlineGameMessage(event.detail.envelope));
  client.addEventListener("social-message", (event) => {
    const entry = createSocialEntry({
      detail: event.detail,
      room: onlineRoom,
      selfPeerId: client.peerId,
    });
    if (entry) showSocialEntry(entry);
  });
  client.addEventListener("core-error", (event) => {
    onlineStatusEl.textContent = event.detail.message ?? "在线连接出错";
    warningMessage = event.detail.message ?? "";
    render();
  });
}

async function loadOnlineSocialCatalogs(client) {
  socialPhrases = [];
  socialEmojis = [];
  socialCatalogDiagnostics = [];
  const urls = gameConfig?.online?.socialCatalogUrls ?? [];
  if (urls.length === 0) return;

  socialCatalogLoading = true;
  try {
    await client.loadSocialCatalogs(urls);
    socialPhrases = client.getSocialResources({ kind: "phrase" });
    socialEmojis = client.getSocialResources({ kind: "emoji" });
    socialCatalogDiagnostics = client.getSocialCatalogDiagnostics();
  } finally {
    socialCatalogLoading = false;
  }
}

function adoptOnlineRoom(room) {
  onlineRoom = room;
  onlineSide = sideForPeer(room, onlineClient.peerId);
  onlineConnected = Boolean(onlineSide);
  const connectedIds = new Set((room.peers ?? []).filter((peer) => peer.connected !== false).map((peer) => peer.id));
  onlineOpenPeerIds = new Set([...onlineOpenPeerIds].filter((peerId) => connectedIds.has(peerId)));
  const sideText = onlineSide ? sideNames[onlineSide] : "未入座";
  onlineStatusEl.textContent = `房间 ${room.code} · 你是 ${sideText}`;
}

async function createOnlineRoom() {
  const signalingUrl = getSignalingUrl();
  if (!signalingUrl) {
    onlineStatusEl.textContent = `在线配置不可用：${gameConfigError?.message ?? "缺少信令地址"}`;
    return;
  }
  gameMode = "online";
  resetMatchState();
  try {
    const BoardGamesCoreClient = await getBoardGamesCoreClientClass();
    const client = new BoardGamesCoreClient({
      signalingUrl,
      gameId: "punic-chess",
      maxPeers: 2,
    });
    attachOnlineClient(client);
    await loadOnlineSocialCatalogs(client);
    const result = await client.createRoom({
      displayName: onlineNameInput.value.trim() || "Player",
      maxPeers: 2,
    });
    adoptOnlineRoom(result.room);
    roomCodeInput.value = result.room.code;
    setView("game");
    render();
  } catch (error) {
    onlineStatusEl.textContent = error.message;
  }
}

async function joinOnlineRoom() {
  const signalingUrl = getSignalingUrl();
  if (!signalingUrl) {
    onlineStatusEl.textContent = `在线配置不可用：${gameConfigError?.message ?? "缺少信令地址"}`;
    return;
  }
  gameMode = "online";
  resetMatchState();
  try {
    const BoardGamesCoreClient = await getBoardGamesCoreClientClass();
    const client = new BoardGamesCoreClient({
      signalingUrl,
      gameId: "punic-chess",
      maxPeers: 2,
    });
    attachOnlineClient(client);
    await loadOnlineSocialCatalogs(client);
    const result = await client.joinRoom({
      roomCode: roomCodeInput.value.trim(),
      displayName: onlineNameInput.value.trim() || "Player",
    });
    adoptOnlineRoom(result.room);
    setView("game");
    render();
  } catch (error) {
    onlineStatusEl.textContent = error.message;
  }
}

function handleOnlineGameMessage(envelope) {
  if (envelope.type === "game-action") {
    const action = envelope.payload?.action;
    if (!action) return;
    addMoveLog(state.turn, action);
    state = applyAction(state, action);
    selectedPieceId = null;
    selectedSourceId = null;
    previewAction = null;
    warningMessage = "";
    render();
    return;
  }

  if (envelope.type === "game-surrender") {
    const side = envelope.payload?.side;
    if (!side) return;
    moveLog.push(`${sideNames[side]}：投降`);
    state = applySurrender(state, side);
    warningMessage = "";
    render();
    return;
  }

  if (envelope.type === "game-reset") {
    restoreOnlineSnapshot(envelope.payload?.snapshot);
  }
}

function showSocialEntry(entry) {
  socialFlashEntry = entry;
  clearSocialFlashTimer();
  socialFlashTimer = setTimeout(() => {
    socialFlashEntry = null;
    socialFlashTimer = null;
    renderSocialPanel();
  }, 4200);
  renderSocialPanel();
}

function createLocalSocialEntry(envelope, resource) {
  return createSocialEntry({
    detail: {
      envelope,
      message: envelope.payload,
      resource,
    },
    room: onlineRoom,
    selfPeerId: onlineClient?.peerId,
  });
}

function sendOnlinePhrase(resource) {
  if (!onlineClient || !isOnlineReady()) return;
  try {
    const envelope = onlineClient.sendPhrase(resource);
    const entry = createLocalSocialEntry(envelope, resource);
    if (entry) showSocialEntry(entry);
  } catch (error) {
    warningMessage = error.message;
    render();
  }
}

function sendOnlineEmoji(resource) {
  if (!onlineClient || !isOnlineReady()) return;
  try {
    const envelope = onlineClient.sendEmoji(resource);
    const entry = createLocalSocialEntry(envelope, resource);
    if (entry) showSocialEntry(entry);
  } catch (error) {
    warningMessage = error.message;
    render();
  }
}

function getSelectedPiece() {
  return state.pieces.find((piece) => piece.id === selectedPieceId && piece.alive) ?? null;
}

function getSelectedActions() {
  const piece = getSelectedPiece();
  return piece ? getLegalActions(state, piece.id) : [];
}

function getSelectedCombos(piece) {
  return getCombinations(state, piece.side).filter((combo) => combo.memberIds.includes(piece.id));
}

function getActionSources() {
  const piece = getSelectedPiece();
  if (!piece) return [];

  const actions = getSelectedActions();
  const sources = [
    {
      id: "single",
      type: "single",
      label: `单兵：${fullPieceNames[piece.type]}`,
      memberIds: [piece.id],
      actions: actions.filter((action) => action.kind !== "group" && action.kind !== "combo-step"),
    },
  ];

  for (const combo of getSelectedCombos(piece)) {
    sources.push({
      id: `combo:${combo.id}`,
      type: "combo",
      combo,
      label: comboSourceLabel(state, combo),
      memberIds: [...combo.memberIds],
      actions: actions.filter((action) => action.group?.id === combo.id),
    });
  }

  return sources;
}

function getSelectedSource() {
  return getActionSources().find((source) => source.id === selectedSourceId) ?? null;
}

function getVisibleActions() {
  return getSelectedSource()?.actions ?? [];
}

function squareKey(col, row) {
  return `${col},${row}`;
}

function createPreviewMarker(className) {
  const marker = document.createElement("span");
  marker.className = `preview-marker ${className}`;
  marker.ariaHidden = "true";
  return marker;
}

function renderBoard() {
  const selected = getSelectedPiece();
  const selectedSource = getSelectedSource();
  const legalActions = getVisibleActions();
  const legalTargets = new Set(legalActions.map((action) => squareKey(action.to.col, action.to.row)));
  const protectedIds = getProtectedPieceIds(state);
  const comboMemberIds = new Set(getCombinations(state).flatMap((combo) => combo.memberIds));
  const sourceMemberIds = new Set(selectedSource?.memberIds ?? []);
  const preview = previewAction ? getActionPreview(state, previewAction) : null;
  const previewGhosts = new Map();
  const previewSourceIds = new Set();
  const previewCaptureSquares = new Set();
  const previewBlockedSquares = new Set();

  if (preview) {
    for (const move of preview.moves) {
      previewSourceIds.add(move.pieceId);
      previewGhosts.set(squareKey(move.to.col, move.to.row), move);
    }

    for (const capturedId of preview.captureIds) {
      const captured = state.pieces.find((piece) => piece.id === capturedId && piece.alive);
      if (captured) previewCaptureSquares.add(squareKey(captured.col, captured.row));
    }

    for (const square of preview.blockedSquares) {
      previewBlockedSquares.add(squareKey(square.col, square.row));
    }
  }

  boardEl.replaceChildren();

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.col = String(col);
      cell.dataset.row = String(row);

      if (isOwnPalace("north", col, row)) cell.classList.add("north-palace");
      if (isOwnPalace("south", col, row)) cell.classList.add("south-palace");
      if (isBlocked(state, col, row)) cell.classList.add("blocked");
      if (selected?.col === col && selected?.row === row) cell.classList.add("selected");
      if (legalTargets.has(squareKey(col, row))) cell.classList.add("legal-target");
      if (previewCaptureSquares.has(squareKey(col, row))) cell.classList.add("preview-capture");
      if (previewBlockedSquares.has(squareKey(col, row))) cell.classList.add("preview-blocked");

      cell.addEventListener("click", () => handleCellClick(col, row));

      if (previewCaptureSquares.has(squareKey(col, row))) {
        cell.append(createPreviewMarker("preview-capture-marker"));
      }
      if (previewBlockedSquares.has(squareKey(col, row))) {
        cell.append(createPreviewMarker("preview-blocked-marker"));
      }

      const piece = getPieceAt(state, col, row);
      if (piece) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `piece ${piece.side} type-${piece.type}`;
        button.textContent = pieceNames[piece.type];
        button.title = getPieceLabel(piece);
        button.ariaLabel = `${getPieceLabel(piece)}，${coord(col, row)}`;
        if (protectedIds.has(piece.id)) button.classList.add("protected");
        if (comboMemberIds.has(piece.id)) button.classList.add("combo-member");
        if (sourceMemberIds.has(piece.id)) button.classList.add("source-member");
        if (previewSourceIds.has(piece.id)) button.classList.add("preview-source-piece");
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          handlePieceClick(piece.id);
        });
        cell.append(button);
      }

      const ghost = previewGhosts.get(squareKey(col, row));
      if (ghost) {
        const ghostEl = document.createElement("div");
        ghostEl.className = `piece preview-piece ${ghost.side} type-${ghost.type}`;
        ghostEl.textContent = pieceNames[ghost.type];
        ghostEl.ariaHidden = "true";
        cell.append(ghostEl);
      }

      boardEl.append(cell);
    }
  }
}

function renderStatus() {
  statusEl.classList.toggle("win", Boolean(state.winner));
  statusEl.classList.toggle("warning", Boolean(warningMessage));
  modeLabelEl.textContent = isAiGame() ? `人机对抗 · 玩家：${sideNames[humanSide]}` : "本地双人";
  if (isOnlineGame()) {
    const roomText = onlineRoom ? `房间：${onlineRoom.code}` : "连接中";
    const sideText = onlineSide ? `你是：${sideNames[onlineSide]}` : "未入座";
    modeLabelEl.textContent = `在线模式 · ${sideText} · ${roomText}`;
  }
  statusEl.textContent =
    warningMessage ||
    (state.winner
      ? `${sideNames[state.winner]}获胜`
      : isOnlineGame() && !isOnlineReady()
        ? onlineWaitMessage()
      : aiThinking
        ? `${sideNames[aiSide]}思考中`
        : `${sideNames[state.turn]}回合`);
  undoBtn.disabled = isOnlineGame() || history.length === 0;
  resetBtn.disabled = isOnlineGame() && !onlineClient?.isHost;
  surrenderBtn.disabled = Boolean(state.winner) || (isAiGame() && (aiThinking || !isHumanTurn())) || (isOnlineGame() && !isHumanTurn());
}

function renderActions() {
  const piece = getSelectedPiece();
  const sources = getActionSources();
  const selectedSource = getSelectedSource();
  actionsEl.replaceChildren();

  if (!piece) {
    selectedInfoEl.textContent = "未选择";
    actionsEl.append(emptyLine(getActionEmptyText()));
    return;
  }

  if (aiThinking || !isHumanTurn()) {
    selectedInfoEl.textContent = "未选择";
    actionsEl.append(emptyLine(getActionEmptyText()));
    return;
  }

  selectedInfoEl.textContent = `${getPieceLabel(piece)} · ${coord(piece.col, piece.row)}`;

  const sourceList = document.createElement("div");
  sourceList.className = "source-list";
  for (const source of sources) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "source-button";
    button.classList.toggle("selected-source", source.id === selectedSource?.id);
    button.textContent = source.label;
    button.title = source.label;
    button.addEventListener("click", () => {
      previewAction = null;
      selectedSourceId = source.id;
      render();
    });
    sourceList.append(button);
  }
  actionsEl.append(sourceList);

  if (!selectedSource) {
    actionsEl.append(emptyLine("先选择单兵或一个具体组合"));
    return;
  }

  const actionTitle = document.createElement("div");
  actionTitle.className = "action-subtitle";
  actionTitle.textContent = "具体行动";
  actionsEl.append(actionTitle);

  if (selectedSource.actions.length === 0) {
    actionsEl.append(emptyLine("这个来源没有合法行动"));
    return;
  }

  for (const action of selectedSource.actions) {
    actionsEl.append(renderActionButton(action));
  }
}

function renderActionButton(action) {
  const effects = getActionEffects(state, action);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button";

  const label = document.createElement("span");
  label.className = "action-label";
  label.textContent = formatActionLabel(state, action);
  button.append(label);

  const tags = formatActionTags(state, action, effects);
  if (tags.length > 0) {
    const tagLine = document.createElement("span");
    tagLine.className = "action-tags";
    for (const tag of tags) {
      const tagEl = document.createElement("span");
      tagEl.className = `action-tag ${tag.tone === "danger" ? "danger" : "info"}`;
      tagEl.textContent = tag.text;
      tagLine.append(tagEl);
    }
    button.append(tagLine);
  }

  button.addEventListener("pointerenter", () => showActionPreview(action));
  button.addEventListener("pointerleave", () => clearActionPreview(action));
  button.addEventListener("mouseenter", () => showActionPreview(action));
  button.addEventListener("mouseleave", () => clearActionPreview(action));
  button.addEventListener("focus", () => showActionPreview(action));
  button.addEventListener("blur", () => clearActionPreview(action));
  button.addEventListener("pointerdown", () => showActionPreview(action));
  button.addEventListener("pointerup", () => clearActionPreview(action));
  button.addEventListener("pointercancel", () => clearActionPreview(action));
  button.addEventListener("click", () => performAction(action));
  return button;
}

function showActionPreview(action) {
  if (previewAction === action) return;
  previewAction = action;
  renderBoard();
}

function clearActionPreview(action) {
  if (previewAction !== action) return;
  previewAction = null;
  renderBoard();
}

function emptyLine(text) {
  const line = document.createElement("div");
  line.className = "empty-state";
  line.textContent = text;
  return line;
}

function getActionEmptyText() {
  if (isOnlineGame() && !isOnlineReady()) return onlineWaitMessage();
  if (isOnlineGame() && !isHumanTurn()) return "等待对手行动";
  if (aiThinking || isAiTurn()) return "等待机器行动";
  return "请选择本方棋子";
}

function renderCombinations() {
  combosEl.replaceChildren();
  const combos = getCombinations(state);
  if (combos.length === 0) {
    combosEl.append(emptyLine("无组合"));
    return;
  }

  const summaries = new Map();
  for (const combo of combos) {
    const key = `${combo.side}:${combo.kind}`;
    summaries.set(key, {
      side: combo.side,
      kind: combo.kind,
      count: (summaries.get(key)?.count ?? 0) + 1,
    });
  }

  for (const combo of summaries.values()) {
    const line = document.createElement("div");
    line.className = "combo-line";
    const kind = document.createElement("span");
    kind.className = "combo-kind";
    kind.textContent = comboNames[combo.kind];
    const side = document.createElement("span");
    side.className = "combo-side";
    side.textContent = `${sideNames[combo.side]} · ${combo.count}组`;
    line.append(kind, side);
    combosEl.append(line);
  }
}

function socialNoticeText() {
  if (!isOnlineGame()) return "";
  if (socialCatalogLoading) return "社交资源加载中";
  if ((gameConfig?.online?.socialCatalogUrls ?? []).length === 0) return "未配置社交资源";
  if (socialPhrases.length === 0 && socialEmojis.length === 0) return "没有可用的快捷语或表情";
  if (!isOnlineReady()) return onlineWaitMessage();
  if (socialCatalogDiagnostics.some((item) => item.level === "error")) return "部分社交资源不可用";
  return "选择快捷语或表情发送";
}

function renderSocialFlash() {
  socialFlashEl.replaceChildren();
  socialFlashEl.classList.toggle("hidden", !socialFlashEntry);
  if (!socialFlashEntry) return;

  const name = document.createElement("div");
  name.className = "social-flash-name";
  name.textContent = socialFlashEntry.direction === "local" ? "你" : socialFlashEntry.senderName;
  socialFlashEl.append(name);

  if (socialFlashEntry.kind === "phrase") {
    const text = document.createElement("div");
    text.className = "social-flash-text";
    text.textContent = socialFlashEntry.text;
    socialFlashEl.append(text);
    return;
  }

  const emoji = document.createElement("div");
  emoji.className = "social-flash-emoji";
  if (socialFlashEntry.assetUrl) {
    const image = document.createElement("img");
    image.src = socialFlashEntry.assetUrl;
    image.alt = "";
    image.ariaHidden = "true";
    emoji.append(image);
  }
  socialFlashEl.append(emoji);
}

function renderSocialButtons(container, resources, kind, expanded) {
  container.replaceChildren();
  container.classList.toggle("emoji-actions", kind === "emoji");
  socialTrayEl.classList.toggle("hidden", !expanded);
  if (!expanded) return;

  if (resources.length === 0) {
    container.append(emptyLine(kind === "phrase" ? "无快捷语" : "无表情"));
    return;
  }

  for (const resource of resources) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `social-button ${kind === "emoji" ? "emoji-button" : ""}`;
    button.disabled = !isOnlineReady();
    if (kind === "phrase") {
      button.textContent = resource.text;
      button.ariaLabel = "发送快捷语";
      button.addEventListener("click", () => sendOnlinePhrase(resource));
    } else {
      if (resource.assetUrl) {
        const image = document.createElement("img");
        image.src = resource.assetUrl;
        image.alt = "";
        image.ariaHidden = "true";
        button.append(image);
      } else {
        button.textContent = "表情";
      }
      button.ariaLabel = "发送表情";
      button.addEventListener("click", () => sendOnlineEmoji(resource));
    }
    container.append(button);
  }
}

function renderSocialPanel() {
  onlineSocialPanelEl.classList.toggle("hidden", !isOnlineGame());
  if (!isOnlineGame()) return;
  socialNoticeEl.textContent = socialNoticeText();
  renderSocialFlash();
  const hasPhrases = socialPhrases.length > 0;
  const hasEmojis = socialEmojis.length > 0;
  socialPhraseToggleBtn.disabled = !hasPhrases;
  socialEmojiToggleBtn.disabled = !hasEmojis;
  socialPhraseToggleBtn.classList.toggle("active", socialTrayMode === "phrase");
  socialEmojiToggleBtn.classList.toggle("active", socialTrayMode === "emoji");

  const mode = socialTrayMode === "emoji" ? "emoji" : socialTrayMode === "phrase" ? "phrase" : null;
  renderSocialButtons(
    socialTrayActionsEl,
    mode === "emoji" ? socialEmojis : socialPhrases,
    mode ?? "phrase",
    Boolean(mode),
  );
}

function toggleSocialTray(mode) {
  socialTrayMode = socialTrayMode === mode ? null : mode;
  renderSocialPanel();
}

function renderMoveLog() {
  moveLogEl.replaceChildren();
  for (const entry of moveLog.slice(-24).reverse()) {
    const item = document.createElement("li");
    item.textContent = entry;
    moveLogEl.append(item);
  }
}

function render() {
  if (appView !== "game") return;
  if (selectedPieceId && !getSelectedPiece()) selectedPieceId = null;
  if (selectedSourceId && !getSelectedSource()) selectedSourceId = null;
  renderStatus();
  renderBoard();
  renderActions();
  renderCombinations();
  renderSocialPanel();
  renderMoveLog();
}

function handlePieceClick(pieceId) {
  const piece = state.pieces.find((item) => item.id === pieceId && item.alive);
  if (!piece || piece.side !== state.turn || state.winner || aiThinking || !isHumanTurn()) return;
  warningMessage = "";
  previewAction = null;
  selectedSourceId = null;
  selectedPieceId = selectedPieceId === pieceId ? null : pieceId;
  render();
}

function handleCellClick(col, row) {
  const actions = getVisibleActions().filter((action) => action.to.col === col && action.to.row === row);
  if (actions.length === 1) {
    performAction(actions[0]);
  }
}

function saveHistory() {
  history.push({
    state,
    selectedPieceId,
    selectedSourceId,
    moveLog: [...moveLog],
  });
}

function addMoveLog(side, action) {
  moveLog.push(`${sideNames[side]}：${formatActionLabel(state, action)}`);
}

function scheduleAiTurnIfNeeded() {
  clearAiTimer();
  if (!isAiTurn()) {
    aiThinking = false;
    return;
  }

  aiThinking = true;
  selectedPieceId = null;
  selectedSourceId = null;
  previewAction = null;
  render();

  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (appView !== "game" || !isAiTurn() || state.winner) {
      aiThinking = false;
      render();
      return;
    }

    const action = chooseAiAction(state, aiSide);
    aiThinking = false;
    if (!action) {
      warningMessage = "机器无可用行动";
      render();
      return;
    }

    saveHistory();
    addMoveLog(state.turn, action);
    state = applyAction(state, action);
    selectedPieceId = null;
    selectedSourceId = null;
    previewAction = null;
    warningMessage = "";
    render();
  }, 420);
}

function performAction(action, { remote = false } = {}) {
  if (aiThinking || !isHumanTurn()) return;

  const effects = getActionEffects(state, action);
  previewAction = null;
  if (effects.blockedByCheck) {
    warningMessage = "会被将军";
    render();
    return;
  }

  warningMessage = "";
  saveHistory();
  addMoveLog(state.turn, action);
  state = applyAction(state, action);
  if (isOnlineGame() && !remote) {
    onlineClient?.sendGameAction(action);
  }
  selectedPieceId = null;
  selectedSourceId = null;
  render();
  scheduleAiTurnIfNeeded();
}

function surrenderGame() {
  if (state.winner) return;
  if (isAiGame() && (aiThinking || !isHumanTurn())) return;
  if (isOnlineGame() && !isHumanTurn()) return;

  clearAiTimer();
  const surrenderSide = isAiGame() ? humanSide : state.turn;
  warningMessage = "";
  previewAction = null;
  aiThinking = false;
  saveHistory();
  moveLog.push(`${sideNames[surrenderSide]}：投降`);
  state = applySurrender(state, surrenderSide);
  if (isOnlineGame()) {
    onlineClient?.sendGameMessage("game-surrender", { side: surrenderSide });
  }
  selectedPieceId = null;
  selectedSourceId = null;
  render();
}

function resetGame() {
  if (isOnlineGame() && !onlineClient?.isHost) return;
  resetMatchState();
  if (isOnlineGame()) {
    gameMode = "online";
    onlineClient?.sendGameMessage("game-reset", { snapshot: onlineSnapshot() });
  }
  render();
  scheduleAiTurnIfNeeded();
}

function undo() {
  clearAiTimer();
  aiThinking = false;
  let previous = history.pop();
  if (!previous) return;

  state = previous.state;
  selectedPieceId = previous.selectedPieceId;
  selectedSourceId = previous.selectedSourceId;
  warningMessage = "";
  previewAction = null;
  moveLog = previous.moveLog;

  if (isAiGame() && state.turn === aiSide && history.length > 0) {
    previous = history.pop();
    state = previous.state;
    selectedPieceId = previous.selectedPieceId;
    selectedSourceId = previous.selectedSourceId;
    moveLog = previous.moveLog;
  }

  render();
  scheduleAiTurnIfNeeded();
}

localModeBtn.addEventListener("click", startLocalGame);
aiModeBtn.addEventListener("click", showAiSetup);
onlineModeBtn.addEventListener("click", showOnlineSetup);
setupBackBtn.addEventListener("click", goHome);
chooseNorthBtn.addEventListener("click", () => startAiGame("north"));
chooseSouthBtn.addEventListener("click", () => startAiGame("south"));
onlineBackBtn.addEventListener("click", goHome);
createOnlineRoomBtn.addEventListener("click", () => void createOnlineRoom());
joinOnlineRoomBtn.addEventListener("click", () => void joinOnlineRoom());
socialPhraseToggleBtn.addEventListener("click", () => toggleSocialTray("phrase"));
socialEmojiToggleBtn.addEventListener("click", () => toggleSocialTray("emoji"));
homeBtn.addEventListener("click", goHome);
resetBtn.addEventListener("click", resetGame);
undoBtn.addEventListener("click", undo);
surrenderBtn.addEventListener("click", surrenderGame);

setView("home");

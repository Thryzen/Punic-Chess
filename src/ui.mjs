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
} from "./game.mjs";
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

const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const selectedInfoEl = document.querySelector("#selectedInfo");
const actionsEl = document.querySelector("#actions");
const combosEl = document.querySelector("#combos");
const moveLogEl = document.querySelector("#moveLog");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");
const surrenderBtn = document.querySelector("#surrenderBtn");

let state = createInitialState();
let selectedPieceId = null;
let selectedSourceId = null;
let history = [];
let moveLog = [];
let warningMessage = "";
let previewAction = null;

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
  statusEl.textContent = warningMessage || (state.winner ? `${sideNames[state.winner]}获胜` : `${sideNames[state.turn]}回合`);
  undoBtn.disabled = history.length === 0;
  surrenderBtn.disabled = Boolean(state.winner);
}

function renderActions() {
  const piece = getSelectedPiece();
  const sources = getActionSources();
  const selectedSource = getSelectedSource();
  actionsEl.replaceChildren();

  if (!piece) {
    selectedInfoEl.textContent = "未选择";
    actionsEl.append(emptyLine("请选择本方棋子"));
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

function renderMoveLog() {
  moveLogEl.replaceChildren();
  for (const entry of moveLog.slice(-24).reverse()) {
    const item = document.createElement("li");
    item.textContent = entry;
    moveLogEl.append(item);
  }
}

function render() {
  if (selectedPieceId && !getSelectedPiece()) selectedPieceId = null;
  if (selectedSourceId && !getSelectedSource()) selectedSourceId = null;
  renderStatus();
  renderBoard();
  renderActions();
  renderCombinations();
  renderMoveLog();
}

function handlePieceClick(pieceId) {
  const piece = state.pieces.find((item) => item.id === pieceId && item.alive);
  if (!piece || piece.side !== state.turn || state.winner) return;
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

function performAction(action) {
  const effects = getActionEffects(state, action);
  previewAction = null;
  if (effects.blockedByCheck) {
    warningMessage = "会被将军";
    render();
    return;
  }

  warningMessage = "";
  history.push({
    state,
    selectedPieceId,
    selectedSourceId,
    moveLog: [...moveLog],
  });
  moveLog.push(`${sideNames[state.turn]}：${formatActionLabel(state, action)}`);
  state = applyAction(state, action);
  selectedPieceId = null;
  selectedSourceId = null;
  render();
}

function surrenderGame() {
  if (state.winner) return;

  warningMessage = "";
  previewAction = null;
  history.push({
    state,
    selectedPieceId,
    selectedSourceId,
    moveLog: [...moveLog],
  });
  moveLog.push(`${sideNames[state.turn]}：投降`);
  state = applySurrender(state);
  selectedPieceId = null;
  selectedSourceId = null;
  render();
}

function resetGame() {
  state = createInitialState();
  selectedPieceId = null;
  selectedSourceId = null;
  warningMessage = "";
  previewAction = null;
  history = [];
  moveLog = [];
  render();
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  state = previous.state;
  selectedPieceId = previous.selectedPieceId;
  selectedSourceId = previous.selectedSourceId;
  warningMessage = "";
  previewAction = null;
  moveLog = previous.moveLog;
  render();
}

resetBtn.addEventListener("click", resetGame);
undoBtn.addEventListener("click", undo);
surrenderBtn.addEventListener("click", surrenderGame);

render();

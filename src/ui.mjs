import {
  BOARD_COLS,
  BOARD_ROWS,
  applyAction,
  createInitialState,
  getCombinations,
  getLegalActions,
  getPieceAt,
  getProtectedPieceIds,
  isBlocked,
  isOwnPalace,
} from "./game.mjs";

const pieceNames = {
  king: "王",
  queen: "后",
  guard: "卫",
  chariot: "车",
  yellow: "黄",
  soldier: "兵",
};

const fullPieceNames = {
  king: "王",
  queen: "后",
  guard: "卫",
  chariot: "车兵",
  yellow: "黄兵",
  soldier: "兵",
};

const sideNames = {
  north: "罗马共和国",
  south: "迦太基",
};

const comboNames = {
  siege: "攻城车",
  special: "特种兵",
  "three-arms": "三兵种",
};

const directionNames = new Map([
  ["-1,-1", "左上"],
  ["0,-1", "上"],
  ["1,-1", "右上"],
  ["-1,0", "左"],
  ["1,0", "右"],
  ["-1,1", "左下"],
  ["0,1", "下"],
  ["1,1", "右下"],
]);

const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const selectedInfoEl = document.querySelector("#selectedInfo");
const actionsEl = document.querySelector("#actions");
const combosEl = document.querySelector("#combos");
const moveLogEl = document.querySelector("#moveLog");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");

let state = createInitialState();
let selectedPieceId = null;
let selectedSourceId = null;
let history = [];
let moveLog = [];

function coord(col, row) {
  return `${col + 1}列${row + 1}行`;
}

function getPieceLabel(piece) {
  return `${sideNames[piece.side]}${fullPieceNames[piece.type]}`;
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

function comboMemberLabel(memberId) {
  const member = state.pieces.find((item) => item.id === memberId);
  if (!member) return "";
  return `${fullPieceNames[member.type]}${coord(member.col, member.row)}`;
}

function comboSourceLabel(combo) {
  return `${comboNames[combo.kind]}：${combo.memberIds.map(comboMemberLabel).join(" + ")}`;
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
      label: comboSourceLabel(combo),
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

function actionLabel(action) {
  const piece = state.pieces.find((item) => item.id === action.pieceId);
  const target = getPieceAt(state, action.to.col, action.to.row);
  const place = coord(action.to.col, action.to.row);

  if (action.kind === "group") {
    const direction = directionNames.get(`${action.group.dx},${action.group.dy}`);
    return `${comboNames[action.group.kind]}整体${direction}：${fullPieceNames[piece.type]}到${place}`;
  }

  if (action.kind === "combo-step") {
    const capture = target ? `，吃${getPieceLabel(target)}` : "";
    return `组合内移动：${fullPieceNames[piece.type]}到${place}${capture}`;
  }

  if (action.kind === "guard-clash") {
    return `卫同归：到${place}${target ? `，带走${getPieceLabel(target)}` : ""}`;
  }

  if (action.kind === "capture") {
    return `${fullPieceNames[piece.type]}吃${getPieceLabel(target)}：${place}`;
  }

  return `${fullPieceNames[piece.type]}到${place}`;
}

function renderBoard() {
  const selected = getSelectedPiece();
  const selectedSource = getSelectedSource();
  const legalActions = getVisibleActions();
  const legalTargets = new Set(legalActions.map((action) => `${action.to.col},${action.to.row}`));
  const protectedIds = getProtectedPieceIds(state);
  const comboMemberIds = new Set(getCombinations(state).flatMap((combo) => combo.memberIds));
  const sourceMemberIds = new Set(selectedSource?.memberIds ?? []);

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
      if (legalTargets.has(`${col},${row}`)) cell.classList.add("legal-target");

      cell.addEventListener("click", () => handleCellClick(col, row));

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
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          handlePieceClick(piece.id);
        });
        cell.append(button);
      }

      boardEl.append(cell);
    }
  }
}

function renderStatus() {
  statusEl.classList.toggle("win", Boolean(state.winner));
  statusEl.textContent = state.winner ? `${sideNames[state.winner]}获胜` : `${sideNames[state.turn]}回合`;
  undoBtn.disabled = history.length === 0;
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.textContent = actionLabel(action);
    button.addEventListener("click", () => performAction(action));
    actionsEl.append(button);
  }
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
  history.push({
    state,
    selectedPieceId,
    selectedSourceId,
    moveLog: [...moveLog],
  });
  moveLog.push(`${sideNames[state.turn]}：${actionLabel(action)}`);
  state = applyAction(state, action);
  selectedPieceId = null;
  selectedSourceId = null;
  render();
}

function resetGame() {
  state = createInitialState();
  selectedPieceId = null;
  selectedSourceId = null;
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
  moveLog = previous.moveLog;
  render();
}

resetBtn.addEventListener("click", resetGame);
undoBtn.addEventListener("click", undo);

render();

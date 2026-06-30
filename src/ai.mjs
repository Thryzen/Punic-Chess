import {
  BOARD_ROWS,
  applyAction,
  getActionEffects,
  getCombinations,
  getLegalActions,
  getProtectedPieceIds,
  isOpponentPalace,
  opponentOf,
} from "./game.mjs";

const PIECE_VALUES = {
  king: 10000,
  queen: 900,
  chariot: 650,
  yellow: 420,
  guard: 360,
  soldier: 140,
};

function getPieceById(state, id) {
  return state.pieces.find((piece) => piece.id === id) ?? null;
}

function phaseRatio(state) {
  const aliveNonKings = state.pieces.filter((piece) => piece.alive && piece.type !== "king").length;
  return aliveNonKings / 22;
}

function comboMaterialScore(state, side) {
  const pieces = state.pieces.filter((piece) => piece.alive && piece.side === side);
  const chariots = pieces.filter((piece) => piece.type === "chariot").length;
  const yellows = pieces.filter((piece) => piece.type === "yellow").length;
  return chariots * 0.75 + Math.min(yellows, 2) * 0.55;
}

function isInActiveCombo(state, piece) {
  return getCombinations(state, piece.side).some((combo) => combo.memberIds.includes(piece.id));
}

function pieceValue(state, piece) {
  if (!piece) return 0;
  const phase = phaseRatio(state);

  if (piece.type === "soldier") {
    const comboBonus = isInActiveCombo(state, piece) ? 280 + 120 * phase : 0;
    return 160 + 320 * phase + 80 * phase * comboMaterialScore(state, piece.side) + comboBonus;
  }

  if (piece.type === "queen") {
    return PIECE_VALUES.queen + 260 * (1 - phase);
  }

  if (piece.type === "chariot") {
    return PIECE_VALUES.chariot + 220 * (1 - phase);
  }

  if (piece.type === "yellow") {
    return PIECE_VALUES.yellow + 70 * phase + 90 * (1 - phase);
  }

  return PIECE_VALUES[piece.type];
}

function activeStateForSide(state, side) {
  return state.turn === side ? state : { ...state, turn: side };
}

function getAllActions(state, side) {
  const activeState = activeStateForSide(state, side);
  return activeState.pieces
    .filter((piece) => piece.alive && piece.side === side)
    .flatMap((piece) => getLegalActions(activeState, piece.id));
}

function actionKey(action) {
  const groupKey = action.group ? `${action.group.id}:${action.group.dx},${action.group.dy}` : "";
  return `${action.kind}:${action.pieceId}:${action.to.col},${action.to.row}:${groupKey}`;
}

function progressFor(side, row) {
  return side === "north" ? row : BOARD_ROWS - 1 - row;
}

function captureScore(state, action, next = applyAction(state, action)) {
  const captured = (action.captures ?? []).map((id) => getPieceById(state, id)).filter(Boolean);
  const capturedValue = captured.reduce((total, piece) => total + pieceValue(state, piece), 0);
  const moving = getPieceById(state, action.pieceId);
  const moverSide = moving?.side ?? state.turn;
  const ownLossValue = state.pieces
    .filter((piece) => piece.alive && piece.side === moverSide)
    .filter((piece) => !getPieceById(next, piece.id)?.alive)
    .reduce((total, piece) => total + pieceValue(state, piece), 0);

  if (ownLossValue > 0) {
    return capturedValue * 3.2 - ownLossValue * 5.2;
  }

  return capturedValue * 4.2;
}

function movedPieces(state, action) {
  if (action.kind === "group") {
    return action.group.memberIds.map((id) => getPieceById(state, id)).filter(Boolean);
  }
  return [getPieceById(state, action.pieceId)].filter(Boolean);
}

function movementScore(state, action, side) {
  let score = 0;
  for (const piece of movedPieces(state, action)) {
    const fromProgress = progressFor(side, piece.row);
    const toProgress = progressFor(side, piece.row + (action.group?.dy ?? action.to.row - piece.row));
    score += (toProgress - fromProgress) * (piece.type === "soldier" ? 18 : 10);
  }
  return score;
}

function comboScore(state, next, side) {
  const beforeCombos = getCombinations(state, side);
  const afterCombos = getCombinations(next, side);
  const beforeProtected = getProtectedPieceIds(state);
  const afterProtected = getProtectedPieceIds(next);

  const beforeProtectedValue = state.pieces
    .filter((piece) => piece.alive && piece.side === side && beforeProtected.has(piece.id))
    .reduce((total, piece) => total + pieceValue(state, piece), 0);
  const afterProtectedValue = next.pieces
    .filter((piece) => piece.alive && piece.side === side && afterProtected.has(piece.id))
    .reduce((total, piece) => total + pieceValue(next, piece), 0);

  return (afterCombos.length - beforeCombos.length) * 70 + (afterProtectedValue - beforeProtectedValue) * 0.08;
}

function siegePressureScore(next, side) {
  let score = 0;
  for (const combo of getCombinations(next, side)) {
    if (combo.kind !== "siege") continue;
    for (const id of combo.memberIds) {
      const member = getPieceById(next, id);
      if (!member) continue;
      score += progressFor(side, member.row) * 16;
      if (isOpponentPalace(side, member.col, member.row)) score += 120;
    }
  }
  return score;
}

function replyRiskScore(state, side) {
  if (state.winner) return 0;
  const opponent = opponentOf(side);
  const opponentState = activeStateForSide(state, opponent);
  let best = 0;

  for (const action of getAllActions(opponentState, opponent)) {
    const next = applyAction(opponentState, action);
    if (next.winner === opponent) return 80000;

    let score = captureScore(opponentState, action, next);
    score += movementScore(opponentState, action, opponent) * 0.25;
    best = Math.max(best, score);
  }

  return best;
}

function scoreAction(state, action, side, effects) {
  if (effects.blockedByCheck) return Number.NEGATIVE_INFINITY;

  const next = applyAction(state, action);
  if (next.winner === side) return 100000 + captureScore(state, action, next);

  let score = 0;
  score += captureScore(state, action, next);
  score += movementScore(state, action, side);
  score += comboScore(state, next, side);
  score += siegePressureScore(next, side);

  if (effects.entersCheck) score -= 4200;

  score -= replyRiskScore(next, side) * 0.7;
  return score;
}

export function chooseAiAction(state, side = state.turn) {
  if (state.winner) return null;
  const activeState = activeStateForSide(state, side);
  const candidates = getAllActions(activeState, side)
    .map((action) => ({ action, effects: getActionEffects(activeState, action) }))
    .filter((candidate) => !candidate.effects.blockedByCheck)
    .sort((a, b) => actionKey(a.action).localeCompare(actionKey(b.action)));

  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const { action, effects } of candidates) {
    const score = scoreAction(activeState, action, side, effects);
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }

  return best;
}

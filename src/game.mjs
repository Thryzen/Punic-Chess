export const BOARD_COLS = 6;
export const BOARD_ROWS = 10;

export const SIDES = ["north", "south"];

const DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const ORTHOGONAL_DIRECTIONS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

function makePiece(id, side, type, col, row) {
  return { id, side, type, col, row, alive: true };
}

export function createInitialState() {
  return {
    turn: "north",
    winner: null,
    blocked: [],
    moveNumber: 1,
    pieces: [
      makePiece("north_guard_left", "north", "guard", 1, 0),
      makePiece("north_king", "north", "king", 2, 0),
      makePiece("north_queen", "north", "queen", 3, 0),
      makePiece("north_guard_right", "north", "guard", 4, 0),
      makePiece("north_chariot_left", "north", "chariot", 0, 2),
      makePiece("north_yellow_left", "north", "yellow", 2, 2),
      makePiece("north_yellow_right", "north", "yellow", 3, 2),
      makePiece("north_chariot_right", "north", "chariot", 5, 2),
      makePiece("north_soldier_far_left", "north", "soldier", 0, 3),
      makePiece("north_soldier_left", "north", "soldier", 1, 3),
      makePiece("north_soldier_right", "north", "soldier", 4, 3),
      makePiece("north_soldier_far_right", "north", "soldier", 5, 3),

      makePiece("south_soldier_far_left", "south", "soldier", 0, 6),
      makePiece("south_soldier_left", "south", "soldier", 1, 6),
      makePiece("south_soldier_right", "south", "soldier", 4, 6),
      makePiece("south_soldier_far_right", "south", "soldier", 5, 6),
      makePiece("south_chariot_left", "south", "chariot", 0, 7),
      makePiece("south_yellow_left", "south", "yellow", 2, 7),
      makePiece("south_yellow_right", "south", "yellow", 3, 7),
      makePiece("south_chariot_right", "south", "chariot", 5, 7),
      makePiece("south_guard_left", "south", "guard", 1, 9),
      makePiece("south_queen", "south", "queen", 2, 9),
      makePiece("south_king", "south", "king", 3, 9),
      makePiece("south_guard_right", "south", "guard", 4, 9),
    ],
  };
}

export function cloneState(state) {
  return {
    turn: state.turn,
    winner: state.winner ?? null,
    moveNumber: state.moveNumber ?? 1,
    blocked: (state.blocked ?? []).map((square) => ({ ...square })),
    pieces: state.pieces.map((piece) => ({ ...piece })),
  };
}

export function isInsideBoard(col, row) {
  return col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS;
}

export function isOwnPalace(side, col, row) {
  if (col < 1 || col > 4) return false;
  return side === "north" ? row >= 0 && row <= 2 : row >= 7 && row <= 9;
}

export function isOpponentPalace(side, col, row) {
  return isOwnPalace(opponentOf(side), col, row);
}

export function opponentOf(side) {
  return side === "north" ? "south" : "north";
}

export function isBlocked(state, col, row) {
  return (state.blocked ?? []).some((square) => square.col === col && square.row === row);
}

export function getPieceAt(state, col, row) {
  return state.pieces.find((piece) => piece.alive && piece.col === col && piece.row === row) ?? null;
}

function getPieceById(state, id) {
  return state.pieces.find((piece) => piece.id === id) ?? null;
}

function alivePieces(state, side = null) {
  return state.pieces.filter((piece) => piece.alive && (!side || piece.side === side));
}

function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

function fitsInThreeByThree(pieces) {
  const cols = pieces.map((piece) => piece.col);
  const rows = pieces.map((piece) => piece.row);
  return Math.max(...cols) - Math.min(...cols) <= 2 && Math.max(...rows) - Math.min(...rows) <= 2;
}

function comboId(kind, ids) {
  return `${kind}:${ids.join(":")}`;
}

export function getCombinations(state, side = null) {
  const sides = side ? [side] : SIDES;
  const combos = [];

  for (const currentSide of sides) {
    const pieces = alivePieces(state, currentSide);
    const chariots = pieces.filter((piece) => piece.type === "chariot");
    const soldiers = pieces.filter((piece) => piece.type === "soldier");
    const yellows = pieces.filter((piece) => piece.type === "yellow");

    for (const chariot of chariots) {
      for (const soldier of soldiers) {
        if (chebyshevDistance(chariot, soldier) === 1) {
          combos.push({
            id: comboId("siege", [chariot.id, soldier.id]),
            kind: "siege",
            side: currentSide,
            memberIds: [chariot.id, soldier.id],
            protectedIds: [chariot.id],
          });
        }
      }
    }

    for (let i = 0; i < yellows.length; i += 1) {
      for (let j = i + 1; j < yellows.length; j += 1) {
        for (const soldier of soldiers) {
          const members = [soldier, yellows[i], yellows[j]];
          if (fitsInThreeByThree(members)) {
            combos.push({
              id: comboId("special", [soldier.id, yellows[i].id, yellows[j].id]),
              kind: "special",
              side: currentSide,
              memberIds: [soldier.id, yellows[i].id, yellows[j].id],
              protectedIds: [yellows[i].id, yellows[j].id],
            });
          }
        }
      }
    }

    for (const chariot of chariots) {
      for (const yellow of yellows) {
        for (const soldier of soldiers) {
          const members = [chariot, yellow, soldier];
          if (fitsInThreeByThree(members)) {
            combos.push({
              id: comboId("three-arms", [chariot.id, yellow.id, soldier.id]),
              kind: "three-arms",
              side: currentSide,
              memberIds: [chariot.id, yellow.id, soldier.id],
              protectedIds: [chariot.id, yellow.id],
            });
          }
        }
      }
    }
  }

  return combos;
}

export function getProtectedPieceIds(state) {
  const protectedIds = new Set();
  for (const combo of getCombinations(state)) {
    for (const id of combo.protectedIds) {
      protectedIds.add(id);
    }
  }
  return protectedIds;
}

function isProtected(state, piece) {
  return piece ? getProtectedPieceIds(state).has(piece.id) : false;
}

function addAction(actions, action) {
  const groupKey = action.group ? `${action.group.id}:${action.group.dx},${action.group.dy}` : "";
  const key = `${action.pieceId}:${action.kind}:${action.to.col},${action.to.row}:${groupKey}`;
  if (!actions.some((existing) => existing.key === key)) {
    actions.push({ ...action, key });
  }
}

function makeStepAction(state, piece, col, row, kind = null) {
  if (!isInsideBoard(col, row) || isBlocked(state, col, row)) return null;
  const target = getPieceAt(state, col, row);
  if (target?.side === piece.side) return null;
  if (target && isProtected(state, target)) return null;
  const actionKind = kind ?? (target ? "capture" : "move");
  return {
    kind: target && (piece.type === "guard" || target.type === "guard") ? "guard-clash" : actionKind,
    pieceId: piece.id,
    from: { col: piece.col, row: piece.row },
    to: { col, row },
    captures: target ? [target.id] : [],
  };
}

function addSingleStepActions(state, actions, piece, directions, options = {}) {
  for (const [dx, dy] of directions) {
    const col = piece.col + dx;
    const row = piece.row + dy;
    if (options.palaceOnly && !isOwnPalace(piece.side, col, row)) continue;
    const action = makeStepAction(state, piece, col, row);
    if (action) addAction(actions, action);
  }
}

function addSlidingActions(state, actions, piece, directions) {
  for (const [dx, dy] of directions) {
    let col = piece.col + dx;
    let row = piece.row + dy;
    while (isInsideBoard(col, row) && !isBlocked(state, col, row)) {
      const target = getPieceAt(state, col, row);
      if (!target) {
        addAction(actions, {
          kind: "move",
          pieceId: piece.id,
          from: { col: piece.col, row: piece.row },
          to: { col, row },
          captures: [],
        });
      } else {
        if (target.side !== piece.side && !isProtected(state, target)) {
          addAction(actions, {
            kind: target.type === "guard" ? "guard-clash" : "capture",
            pieceId: piece.id,
            from: { col: piece.col, row: piece.row },
            to: { col, row },
            captures: [target.id],
          });
        }
        break;
      }
      col += dx;
      row += dy;
    }
  }
}

function addInherentActions(state, actions, piece) {
  if (piece.type === "king") {
    addSingleStepActions(state, actions, piece, DIRECTIONS, { palaceOnly: true });
    return;
  }

  if (piece.type === "guard") {
    addSingleStepActions(state, actions, piece, DIRECTIONS, { palaceOnly: true });
    return;
  }

  if (piece.type === "queen") {
    addSlidingActions(state, actions, piece, DIRECTIONS);
    return;
  }

  if (piece.type === "chariot") {
    addSlidingActions(state, actions, piece, ORTHOGONAL_DIRECTIONS);
    return;
  }

  if (piece.type === "yellow") {
    addSingleStepActions(state, actions, piece, DIRECTIONS);
    return;
  }

  if (piece.type === "soldier") {
    const dy = piece.side === "north" ? 1 : -1;
    const action = makeStepAction(state, piece, piece.col, piece.row + dy);
    if (action) addAction(actions, action);
  }
}

function stateAfterSimpleMoveForCheck(state, piece, col, row) {
  const next = cloneState(state);
  const moved = getPieceById(next, piece.id);
  const target = getPieceAt(next, col, row);
  if (!moved || !moved.alive || target?.type === "guard" || moved.type === "guard") return null;
  if (target) target.alive = false;
  moved.col = col;
  moved.row = row;
  return next;
}

function addComboStepActions(state, actions, piece) {
  const combos = getCombinations(state, piece.side).filter((combo) => combo.memberIds.includes(piece.id));
  if (combos.length === 0) return;

  for (const [dx, dy] of DIRECTIONS) {
    const col = piece.col + dx;
    const row = piece.row + dy;
    const base = makeStepAction(state, piece, col, row, "combo-step");
    if (!base || base.kind === "guard-clash") continue;
    const next = stateAfterSimpleMoveForCheck(state, piece, col, row);
    if (!next) continue;
    const stillCombined = getCombinations(next, piece.side).some((combo) => combo.memberIds.includes(piece.id));
    if (stillCombined) addAction(actions, { ...base, kind: "combo-step" });
  }
}

function getGroupTargetOccupant(state, memberIds, col, row) {
  const occupant = getPieceAt(state, col, row);
  if (!occupant) return null;
  return memberIds.includes(occupant.id) ? null : occupant;
}

function addGroupActions(state, actions, piece) {
  const combos = getCombinations(state, piece.side).filter((combo) => combo.memberIds.includes(piece.id));
  const protectedIds = getProtectedPieceIds(state);

  for (const combo of combos) {
    const members = combo.memberIds.map((id) => getPieceById(state, id)).filter(Boolean);
    for (const [dx, dy] of DIRECTIONS) {
      let legal = true;
      const captures = [];

      for (const member of members) {
        const col = member.col + dx;
        const row = member.row + dy;
        if (!isInsideBoard(col, row) || isBlocked(state, col, row)) {
          legal = false;
          break;
        }

        const occupant = getGroupTargetOccupant(state, combo.memberIds, col, row);
        if (!occupant) continue;
        if (occupant.side === member.side) {
          legal = false;
          break;
        }
        if (member.type !== "soldier" || protectedIds.has(occupant.id)) {
          legal = false;
          break;
        }
        captures.push({ by: member.id, target: occupant.id, col, row });
      }

      if (!legal) continue;
      const selectedTarget = { col: piece.col + dx, row: piece.row + dy };
      addAction(actions, {
        kind: "group",
        pieceId: piece.id,
        from: { col: piece.col, row: piece.row },
        to: selectedTarget,
        captures: captures.map((capture) => capture.target),
        group: {
          id: combo.id,
          kind: combo.kind,
          memberIds: [...combo.memberIds],
          dx,
          dy,
        },
      });
    }
  }
}

export function getLegalActions(state, pieceId) {
  if (state.winner) return [];
  const piece = getPieceById(state, pieceId);
  if (!piece || !piece.alive || piece.side !== state.turn) return [];

  const actions = [];
  addInherentActions(state, actions, piece);
  addComboStepActions(state, actions, piece);
  addGroupActions(state, actions, piece);
  return actions.map(({ key, ...action }) => action);
}

function addBlockedSquare(state, col, row) {
  if (!isBlocked(state, col, row)) {
    state.blocked.push({ col, row });
  }
}

function finishMove(state, moverSide) {
  if (!state.winner) {
    state.winner = getSiegeWinner(state, moverSide);
  }
  if (!state.winner) {
    state.turn = opponentOf(state.turn);
    state.moveNumber = (state.moveNumber ?? 1) + 1;
  }
  return state;
}

function getSiegeWinner(state, side) {
  const siegeCombos = getCombinations(state, side).filter((combo) => combo.kind === "siege");
  for (const combo of siegeCombos) {
    const members = combo.memberIds.map((id) => getPieceById(state, id));
    if (members.every((member) => member?.alive && isOpponentPalace(side, member.col, member.row))) {
      return side;
    }
  }
  return null;
}

function applySimpleAction(next, action, moving) {
  const target = getPieceAt(next, action.to.col, action.to.row);
  if (action.kind === "guard-clash") {
    if (target?.type === "king") next.winner = moving.side;
    moving.alive = false;
    if (target) target.alive = false;
    addBlockedSquare(next, action.to.col, action.to.row);
    return;
  }

  if (target) {
    if (target.type === "king") next.winner = moving.side;
    target.alive = false;
  }
  moving.col = action.to.col;
  moving.row = action.to.row;
}

function applyGroupAction(next, action) {
  const memberIds = action.group.memberIds;
  const members = memberIds.map((id) => getPieceById(next, id)).filter((member) => member?.alive);
  const destinations = new Map();

  for (const member of members) {
    destinations.set(member.id, {
      col: member.col + action.group.dx,
      row: member.row + action.group.dy,
    });
  }

  for (const member of members) {
    if (member.type !== "soldier") continue;
    const destination = destinations.get(member.id);
    const target = getPieceAt(next, destination.col, destination.row);
    if (!target || memberIds.includes(target.id) || target.side === member.side) continue;
    if (target.type === "king") next.winner = member.side;
    if (target.type === "guard") {
      member.alive = false;
      target.alive = false;
      addBlockedSquare(next, destination.col, destination.row);
    } else {
      target.alive = false;
    }
  }

  for (const member of members) {
    if (!member.alive) continue;
    const destination = destinations.get(member.id);
    member.col = destination.col;
    member.row = destination.row;
  }
}

export function applyAction(state, action) {
  const next = cloneState(state);
  if (next.winner) return next;
  const moving = getPieceById(next, action.pieceId);
  if (!moving || !moving.alive) return next;

  if (action.kind === "group") {
    applyGroupAction(next, action);
  } else {
    applySimpleAction(next, action, moving);
  }

  return finishMove(next, moving.side);
}

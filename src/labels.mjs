export const pieceNames = {
  king: "王",
  queen: "后",
  guard: "卫",
  chariot: "车",
  yellow: "黄",
  soldier: "兵",
};

export const fullPieceNames = {
  king: "王",
  queen: "后",
  guard: "卫",
  chariot: "车兵",
  yellow: "黄兵",
  soldier: "兵",
};

export const sideNames = {
  north: "罗马共和国",
  south: "迦太基",
};

export const comboNames = {
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

export function coord(col, row) {
  return `${col + 1}列${row + 1}行`;
}

export function getPieceLabel(piece) {
  return `${sideNames[piece.side]}${fullPieceNames[piece.type]}`;
}

function getPieceById(state, id) {
  return state.pieces.find((piece) => piece.id === id) ?? null;
}

export function comboMemberLabel(state, memberId) {
  const member = getPieceById(state, memberId);
  if (!member) return "";
  return `${fullPieceNames[member.type]}${coord(member.col, member.row)}`;
}

export function comboSourceLabel(state, combo) {
  return `${comboNames[combo.kind]}：${combo.memberIds.map((id) => comboMemberLabel(state, id)).join(" + ")}`;
}

export function formatActionLabel(state, action) {
  const piece = getPieceById(state, action.pieceId);
  const place = coord(action.to.col, action.to.row);
  if (!piece) return place;

  if (action.kind === "group") {
    const direction = directionNames.get(`${action.group.dx},${action.group.dy}`);
    return `${comboNames[action.group.kind]}整体${direction}：${fullPieceNames[piece.type]}到${place}`;
  }

  if (action.kind === "combo-step") {
    return `组合内移动：${fullPieceNames[piece.type]}到${place}`;
  }

  return `${fullPieceNames[piece.type]}到${place}`;
}

export function formatActionTags(state, action, effects) {
  const tags = [];
  const captureLabels = (effects.captureIds ?? [])
    .map((id) => getPieceById(state, id))
    .filter(Boolean)
    .map(getPieceLabel);

  for (const label of captureLabels) {
    tags.push({ tone: "info", text: `吃${label}` });
  }

  if (action.kind === "guard-clash") {
    tags.push({ tone: "info", text: "同归" });
  }

  if (effects.entersCheck) {
    tags.push({ tone: "danger", text: "会被将军" });
  }

  return tags;
}

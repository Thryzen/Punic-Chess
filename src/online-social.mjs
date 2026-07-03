export function socialPeerName(room, peerId) {
  const peer = (room?.peers ?? []).find((item) => item.id === peerId);
  return peer?.displayName || peerId || "未知玩家";
}

export function createSocialEntry({ detail, room, selfPeerId }) {
  const envelope = detail?.envelope;
  const message = detail?.message;
  if (!envelope || !message) return null;

  if (message.kind === "chat") {
    if (!message.phraseId || !message.resourceKey) return null;
    return {
      id: envelope.id,
      direction: envelope.senderId === selfPeerId ? "local" : "remote",
      senderId: envelope.senderId,
      senderName: socialPeerName(room, envelope.senderId),
      kind: "phrase",
      text: message.text,
      resourceKey: message.resourceKey,
      createdAt: envelope.createdAt,
    };
  }

  if (message.kind === "emoji") {
    const resource = detail.resource;
    if (!resource?.assetUrl) return null;
    return {
      id: envelope.id,
      direction: envelope.senderId === selfPeerId ? "local" : "remote",
      senderId: envelope.senderId,
      senderName: socialPeerName(room, envelope.senderId),
      kind: "emoji",
      resourceKey: message.resourceKey,
      assetUrl: resource?.assetUrl ?? "",
      alt: resource?.alt ?? "emoji",
      createdAt: envelope.createdAt,
    };
  }

  return null;
}

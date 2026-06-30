export function seatedPeers(room) {
  return [...(room?.peers ?? [])]
    .filter((peer) => peer.connected !== false)
    .sort((a, b) => {
      if (a.joinedAt !== b.joinedAt) return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, 2);
}

export function sideForPeer(room, peerId) {
  const index = seatedPeers(room).findIndex((peer) => peer.id === peerId);
  return index === 0 ? "north" : index === 1 ? "south" : null;
}

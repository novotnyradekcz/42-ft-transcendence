// The messages that cross the status websocket, and what the context exposes.
// Only two message types, because the server never pushes: the client pings and
// gets the full picture back each time.

// full snapshot of who is online, sent on connect and after every ping
export type StatusInit = {
  type: "status_init";
  online: number[];
};

export type StatusServerMessage = StatusInit;

// keepalive, the server answers with a fresh status_init
export type StatusClientMessage = {
  type: "ping";
};

export interface StatusContextValue {
  // whether that id was in the last snapshot the server sent. works for any
  // user, not just the signed-in one
  statusOf(userId: number): "online" | "offline";
}

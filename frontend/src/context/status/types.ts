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

// shape of the status context
export interface StatusContextValue {
  // whether the user has an open status connection, as the string the ui renders
  statusOf(userId: number): "online" | "offline";
}

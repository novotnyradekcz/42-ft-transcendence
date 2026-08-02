/** Full snapshot of who is online — sent on connect and in reply to a ping. */
export type StatusInit = {
  type: "status_init";
  online: number[];
};

export type StatusServerMessage = StatusInit;

/** Keepalive; the server answers with a fresh `status_init`. */
export type StatusClientMessage = {
  type: "ping";
};

export interface StatusContextValue {
  /** Ids of every user with at least one open status connection. */
  onlineIds: Set<number>;
  /** True once the status socket is open. False for guests. */
  connected: boolean;
  /** True if the given user has an open status connection. */
  isOnline(userId: number): boolean;
  /** `isOnline` as the string the UI renders. */
  statusOf(userId: number): "online" | "offline";
}

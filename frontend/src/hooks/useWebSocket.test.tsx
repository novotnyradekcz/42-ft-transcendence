/**
 * Tests for useWebSocket reconnection.
 *
 * These exist because a socket opened while the server is still compiling dies
 * with a 502 and, before `reconnectMaxDelayMs`, never retried — which silently
 * broke online status for the whole session. The opt-in shape matters just as
 * much: the game must stay one-shot so a reconnect cannot re-enter matchmaking.
 *
 * Run with:  npm test
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

declare global {
  // React reads this to decide whether act() may flush effects synchronously.
  // Without it act() is a no-op wrapper and the assertions below would be
  // checking un-flushed state.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// api.ts reads module state for credentials; a fixed value keeps the URL stable.
vi.mock("../api", () => ({ getCredentials: () => "Basic dGVzdDp0ZXN0" }));

/** Minimal stand-in that records every construction and lets tests fire events. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  sent: string[] = [];
  url: string;
  protocols?: string | string[];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  /** Simulate the server accepting the handshake. */
  fireOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  /** Simulate the connection dropping (server down, 401, network loss). */
  fireClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement) {
  act(() => {
    root.render(ui);
  });
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWebSocket reconnection", () => {
  function Probe({ maxDelay }: { maxDelay?: number }) {
    useWebSocket("/status/ws", { user_id: 2 }, { reconnectMaxDelayMs: maxDelay });
    return null;
  }

  it("happy path: opens exactly one socket with the auth subprotocol", () => {
    render(<Probe maxDelay={10_000} />);

    expect(FakeWebSocket.instances).toHaveLength(1);
    const [ws] = FakeWebSocket.instances;
    expect(ws.url).toContain("/status/ws?user_id=2");
    // credentials are hex-encoded into an `auth-` subprotocol
    expect(String(ws.protocols)).toMatch(/^auth-[0-9a-f]+$/);
  });

  it("happy path: reconnects after an unexpected close once opted in", () => {
    render(<Probe maxDelay={10_000} />);
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => FakeWebSocket.instances[0].fireClose());
    // backoff has not elapsed yet
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => void vi.advanceTimersByTime(500));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("happy path: backoff grows exponentially across consecutive failures", () => {
    render(<Probe maxDelay={10_000} />);

    act(() => FakeWebSocket.instances[0].fireClose());
    act(() => void vi.advanceTimersByTime(500));
    expect(FakeWebSocket.instances).toHaveLength(2);

    // second failure waits 1000ms, so 500 is not enough
    act(() => FakeWebSocket.instances[1].fireClose());
    act(() => void vi.advanceTimersByTime(500));
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => void vi.advanceTimersByTime(500));
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("happy path: a successful open resets the backoff", () => {
    render(<Probe maxDelay={10_000} />);

    act(() => FakeWebSocket.instances[0].fireClose());
    act(() => void vi.advanceTimersByTime(500));
    expect(FakeWebSocket.instances).toHaveLength(2);

    // connection succeeds, then later drops: delay is back to the 500ms base
    act(() => FakeWebSocket.instances[1].fireOpen());
    act(() => FakeWebSocket.instances[1].fireClose());
    act(() => void vi.advanceTimersByTime(500));
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("edge case: backoff is capped at reconnectMaxDelayMs", () => {
    render(<Probe maxDelay={1000} />);

    for (let i = 0; i < 5; i += 1) {
      act(() => FakeWebSocket.instances[i].fireClose());
      act(() => void vi.advanceTimersByTime(1000));
      expect(FakeWebSocket.instances).toHaveLength(i + 2);
    }
  });

  it("edge case: without the option the socket stays one-shot (the game's behaviour)", () => {
    render(<Probe />);
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => FakeWebSocket.instances[0].fireClose());
    act(() => void vi.advanceTimersByTime(60_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("edge case: a null path opens nothing, so guests never connect", () => {
    function GuestProbe() {
      useWebSocket(null, {}, { reconnectMaxDelayMs: 10_000 });
      return null;
    }
    render(<GuestProbe />);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("edge case: unmounting cancels a pending retry", () => {
    render(<Probe maxDelay={10_000} />);
    act(() => FakeWebSocket.instances[0].fireClose());

    act(() => root.unmount());
    act(() => void vi.advanceTimersByTime(60_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
    // re-mount so the shared afterEach unmount stays valid
    root = createRoot(container);
  });

  it("edge case: navigating away (path -> null) does not trigger a retry", () => {
    function Switcher() {
      const [connected, setConnected] = useState(true);
      useWebSocket(
        connected ? "/status/ws" : null,
        { user_id: 2 },
        { reconnectMaxDelayMs: 10_000 },
      );
      return (
        <button type="button" onClick={() => setConnected(false)}>
          logout
        </button>
      );
    }
    render(<Switcher />);
    expect(FakeWebSocket.instances).toHaveLength(1);

    // simulating logout: the effect tears down deliberately
    act(() => {
      container.querySelector("button")!.click();
    });
    act(() => void vi.advanceTimersByTime(60_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

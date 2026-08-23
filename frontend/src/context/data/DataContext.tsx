// The board's content — discussions, mail, games, users — and the rule for when
// each one gets fetched.
//
// Loading follows the page on screen rather than the command that navigated
// there, so a page never waits on the network to render and every failure
// arrives as a log line instead of a blocked prompt.
//
// Two kinds of data, treated differently: content is refetched on every visit
// so other people's posts show up, while the user list is reference data and
// loads once per session. Overlapping callers share one request either way.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listDiscussions, listGames, listMail } from "../../api";
import { errMsg } from "../../errors";
import { useTranslation } from "../language/i18n";
import { useSession } from "../session/useSession";
import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  Page,
  SessionUser,
  UserProfile,
} from "../../types";
import type { DataResource } from "./types";
import { DataContext } from "./useData";

// what each page actually renders, so nothing is fetched before a page that
// needs it is open — the menu, help and the auth screens cost no requests
const PAGE_RESOURCES: Record<Page, DataResource[]> = {
  welcome: [],
  home: [],
  help: [],
  // static text, and readable by guests, so they must not trigger a fetch
  privacy: [],
  terms: [],
  login: [],
  register: [],
  discussions: ["discussions"],
  "discussion-detail": ["discussions"],
  // mail and games show sender / author names, which come from the user list
  mail: ["mail", "users"],
  "mail-detail": ["mail", "users"],
  games: ["games", "users"],
  "game-play": ["games", "users"],
  "game-history": ["games", "users"],
  "game-leaderboard": ["games", "users"],
  "game-achievements": ["games", "users"],
  users: ["users"],
  "user-detail": ["users"],
  friends: ["users"],
  profile: ["users"],
};

// fallback line per resource, used when the error carries no message of its own.
// English here because the keys are the English strings — errMsg translates it
const LOAD_FAILURE: Record<DataResource, string> = {
  discussions: "could not load discussions.",
  games: "could not load games.",
  mail: "could not load mail.",
  users: "could not refresh users.",
};

export function DataProvider({ children }: { children: ReactNode }) {
  const { sessionUser, isRestoring, refreshUsers, knownUsers } = useSession();
  const { t } = useTranslation();

  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] =
    useState<DiscussionThread | null>(null);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // friends come from the session user's id list plus the full user pool
  const friends = useMemo(
    () => knownUsers.filter((u) => sessionUser?.friends.includes(u.id) ?? false),
    [knownUsers, sessionUser?.friends],
  );

  // the user list is reference data — names and avatars — so it's fetched once
  // a session and kept current by the refreshUsers() calls elsewhere (friend
  // add/remove, profile edits) and the status socket. discussions, games and
  // mail are content: every visit refetches them, so a post written in another
  // tab shows up next time the page is opened rather than only after `list`.
  const usersLoaded = useRef(false);
  // requests already on the wire, so overlapping callers share one fetch. this
  // is what stops StrictMode's double mount in dev, and a fast there-and-back
  // between pages, from firing the same request twice.
  const inFlight = useRef<Map<DataResource, Promise<void>>>(new Map());

  // mail is dropped rather than kept because it belongs to one user; the rest
  // is public and will be refetched on the next visit anyway
  const invalidate = useCallback(() => {
    usersLoaded.current = false;
    setMail([]);
    setSelectedMail(null);
  }, []);

  // logging in or out changes who the rows belong to, so drop them; the
  // page-driven load then refetches whatever is on screen for the new identity
  const lastUserId = useRef<number | null>(sessionUser?.id ?? null);
  useEffect(() => {
    const id = sessionUser?.id ?? null;
    if (id === lastUserId.current) return;
    lastUserId.current = id;
    invalidate();
  }, [sessionUser?.id, invalidate]);

  // the actual fetch per resource. users goes through SessionContext because
  // that's where knownUsers lives
  const loadResource = useCallback(
    async (resource: DataResource, user: SessionUser | null): Promise<void> => {
      switch (resource) {
        case "discussions":
          setDiscussions(await listDiscussions());
          return;
        case "games":
          setGames(await listGames());
          return;
        case "mail":
          setMail(user ? await listMail(user.id) : []);
          return;
        case "users":
          await refreshUsers();
          return;
      }
    },
    [refreshUsers],
  );

  // starts a fetch, or joins the one already running for that resource. a
  // forced refresh always issues a new request, since the point of forcing is
  // to pick up a change an in-flight request may predate.
  const startLoad = useCallback(
    (resource: DataResource, user: SessionUser | null, force: boolean) => {
      const existing = force ? undefined : inFlight.current.get(resource);
      if (existing) return existing;

      const request = loadResource(resource, user).finally(() => {
        inFlight.current.delete(resource);
      });
      inFlight.current.set(resource, request);
      return request;
    },
    [loadResource],
  );

  // shared body of ensureForPage and refreshForPage. collects failures instead
  // of throwing, so one dead endpoint doesn't take the whole page with it
  const load = useCallback(
    async (page: Page, force: boolean): Promise<string[]> => {
      // the whole board is behind login now, so a guest has nothing to load
      if (!sessionUser) return [];

      const pending = PAGE_RESOURCES[page].filter((resource) => {
        if (resource !== "users") return true; // content: always fetch fresh
        if (force) return true;
        if (usersLoaded.current) return false;
        // SessionContext fetches the user list itself while restoring a saved
        // session, and again on login. skip until that settles, otherwise a
        // refresh on a user-facing page asks for /users/show twice.
        if (isRestoring || knownUsers.length > 0) return false;
        return true;
      });
      if (pending.length === 0) return [];

      // independent of one another, so they go out together instead of one
      // finishing before the next one starts
      const results = await Promise.allSettled(
        pending.map((resource) => startLoad(resource, sessionUser, force)),
      );

      const errors: string[] = [];
      results.forEach((result, index) => {
        const resource = pending[index];
        if (result.status === "fulfilled") {
          if (resource === "users") usersLoaded.current = true;
        } else {
          errors.push(errMsg(result.reason, LOAD_FAILURE[resource], t));
        }
      });
      return errors;
    },
    [startLoad, sessionUser, knownUsers.length, isRestoring, t],
  );

  const ensureForPage = useCallback((page: Page) => load(page, false), [load]);

  const refreshForPage = useCallback((page: Page) => load(page, true), [load]);

  const refreshBoardForUser = useCallback(
    async (user: SessionUser | null): Promise<string[]> => {
      // signing in as somebody else invalidates the cache; signing back in as
      // the same user leaves it valid, so only drop it when the identity moved
      if ((user?.id ?? null) !== lastUserId.current) invalidate();
      return [];
    },
    [invalidate],
  );

  return (
    <DataContext.Provider
      value={{
        discussions,
        selectedDiscussion,
        mail,
        selectedMail,
        games,
        selectedGame,
        selectedUser,
        friends,
        setSelectedDiscussion,
        setSelectedMail,
        setSelectedGame,
        setSelectedUser,
        ensureForPage,
        refreshForPage,
        refreshBoardForUser,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

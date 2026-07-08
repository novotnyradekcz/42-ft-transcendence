import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listDiscussions, listGames, listMail } from "../api";
import { useSession } from "./SessionContext";
import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  SessionUser,
  UserProfile,
} from "../types";

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

interface DataContextValue {
  discussions: DiscussionThread[];
  selectedDiscussion: DiscussionThread | null;
  mail: MailMessage[];
  selectedMail: MailMessage | null;
  games: GameSummary[];
  selectedGame: GameSummary | null;
  selectedUser: UserProfile | null;
  friends: UserProfile[];
  setSelectedDiscussion: (d: DiscussionThread | null) => void;
  setSelectedMail: (m: MailMessage | null) => void;
  setSelectedGame: (g: GameSummary | null) => void;
  setSelectedUser: (u: UserProfile | null) => void;
  /**
   * Fetches public data (discussions, games) and, when a user is provided,
   * also fetches mail and refreshes the user list.
   * Returns a list of error messages (empty on full success).
   */
  refreshBoard: () => Promise<string[]>;
  /**
   * Same as refreshBoard but uses the provided user for the mail fetch.
   * Call this right after login before React state has propagated.
   */
  refreshBoardForUser: (user: SessionUser | null) => Promise<string[]>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { sessionUser, isRestoring, refreshUsers } = useSession();

  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] =
    useState<DiscussionThread | null>(null);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Friends are derived from the session user's friend ID list + the full user pool.
  const { knownUsers } = useSession();
  const friends = useMemo(
    () => knownUsers.filter((u) => sessionUser?.friends.includes(u.id) ?? false),
    [knownUsers, sessionUser?.friends],
  );

  const refreshBoardForUser = useCallback(
    async (user: SessionUser | null): Promise<string[]> => {
      const errors: string[] = [];

      try {
        setDiscussions(await listDiscussions());
      } catch (e) {
        errors.push(errMsg(e, "could not load discussions."));
      }

      try {
        setGames(await listGames());
      } catch (e) {
        errors.push(errMsg(e, "could not load games."));
      }

      if (user) {
        try {
          setMail(await listMail(user.id));
        } catch (e) {
          errors.push(errMsg(e, "could not load mail."));
        }
        await refreshUsers().catch((e: unknown) => {
          errors.push(errMsg(e, "could not refresh users."));
        });
      }

      return errors;
    },
    [refreshUsers],
  );

  const refreshBoard = useCallback(
    () => refreshBoardForUser(sessionUser),
    [refreshBoardForUser, sessionUser],
  );

  // Initial data load — wait for session restore so mail is fetched when
  // a persisted session exists.
  useEffect(() => {
    if (!isRestoring) {
      void refreshBoard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring]);

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
        refreshBoard,
        refreshBoardForUser,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a <DataProvider>");
  return ctx;
}

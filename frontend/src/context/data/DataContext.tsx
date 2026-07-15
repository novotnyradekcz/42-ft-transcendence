import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listDiscussions, listGames, listMail } from "../../api";
import { useSession } from "../session/useSession";
import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  SessionUser,
  UserProfile,
} from "../../types";
import { DataContext } from "./useData";

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

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

// The owner's People screen: members, pending invitations, and the depots a dispatcher can be given. The provider
// wraps the Profile stack so the list, the invite sheet and a person's screen share one copy. Every change answers
// the person or the whole list, and the list then follows quietly.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource, type Resource } from "@/api/use-resource";
import { useFirm } from "@/auth";
import type { AssignableRole } from "@/domain/people";
import type { PeopleList, Person } from "@/domain/types";

type PeopleValue = {
  resource: Resource<PeopleList>;
  refreshing: boolean;
  reload: (quiet?: boolean) => void;
  replace: (update: (list: PeopleList) => PeopleList) => void;
};

const PeopleContext = createContext<PeopleValue | null>(null);

/** Loads only for owners: nobody else may manage, or even read, the firm's members. */
export function PeopleProvider({ children }: PropsWithChildren) {
  const { firm } = useFirm();
  const owner = firm.status === "ready" && firm.role === "owner";
  const { resource, refreshing, reload, replace } = useResource<PeopleList>(owner ? "/api/people" : null);
  return <PeopleContext.Provider value={{ resource, refreshing, reload, replace }}>{children}</PeopleContext.Provider>;
}

function usePeopleContext(): PeopleValue {
  const value = useContext(PeopleContext);
  if (!value) throw new Error("usePeople needs a PeopleProvider");
  return value;
}

/** The list, reloaded quietly whenever the screen comes back into focus (not on its first focus). */
export function usePeople() {
  const people = usePeopleContext();
  const { reload } = people;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
  return people;
}

/** Invite, revoke, change a role or depots, remove. Each resolves the failure code, or null once saved. */
export function usePeopleActions() {
  const api = useApi();
  const { resource, reload, replace } = usePeopleContext();
  const list = resource.status === "ready" ? resource.data : null;

  const run = useCallback(async (call: () => Promise<void>): Promise<ApiFailure | null> => {
    try {
      await call();
      return null;
    } catch (error) {
      return failureOf(error);
    }
  }, []);

  const showList = useCallback((next: PeopleList) => replace(() => next), [replace]);
  const showPerson = useCallback(
    (person: Person) =>
      replace((current) => ({ ...current, members: current.members.map((m) => (m.userId === person.userId ? person : m)) })),
    [replace],
  );

  return {
    list,
    person: (userId: string | undefined): Person | undefined => list?.members.find((m) => m.userId === userId),
    invite: (email: string, role: AssignableRole) =>
      run(async () => {
        await api("/api/people/invitations", { method: "POST", body: { email, role } });
        reload(true);
      }),
    revoke: (id: string) =>
      run(async () => showList(await api<PeopleList>(`/api/people/invitations/${id}`, { method: "DELETE" }))),
    setRole: (userId: string, role: AssignableRole) =>
      run(async () => showPerson(await api<Person>(`/api/people/${userId}`, { method: "PATCH", body: { role } }))),
    setDepots: (userId: string, depotIds: string[]) =>
      run(async () => showPerson(await api<Person>(`/api/people/${userId}`, { method: "PATCH", body: { depotIds } }))),
    remove: (userId: string) =>
      run(async () => showList(await api<PeopleList>(`/api/people/${userId}`, { method: "DELETE" }))),
  };
}

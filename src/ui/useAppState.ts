import { useSyncExternalStore } from "react";
import { getState, subscribe } from "../state/store";
import type { AppState } from "../domain/types";

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

import { For } from "solid-js";
import type { Chore, Member } from "../types.ts";
import ChoreItem from "./ChoreItem.tsx";

interface ChoreListProps {
  chores: Chore[];
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  nowMs: number;
  emptyMessage: string;
  showPoolAge?: boolean;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

export default function ChoreList(props: ChoreListProps) {
  return (
    <ul class="w-full divide-y divide-gray-100">
      <For
        each={props.chores}
        fallback={
          <li class="p-6 text-center text-muted-text">{props.emptyMessage}</li>
        }
      >
        {(chore) => (
          <ChoreItem
            chore={chore}
            members={props.members}
            currentMemberId={props.currentMemberId}
            householdTimeZone={props.householdTimeZone}
            nowMs={props.nowMs}
            showPoolAge={props.showPoolAge}
            onUpdate={props.onUpdate}
            onEdit={props.onEdit}
            onReconcile={props.onReconcile}
            onToggleSuccess={props.onToggleSuccess}
          />
        )}
      </For>
    </ul>
  );
}

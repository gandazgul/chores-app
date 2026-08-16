import type { Chore, Member } from "../types.ts";
import ChoreItem from "./ChoreItem.tsx";

interface ChoreListProps {
  chores: Chore[];
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  emptyMessage: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

export default function ChoreList(props: ChoreListProps) {
  return (
    <ul class="w-full divide-y divide-gray-100">
      {props.chores.length === 0
        ? <li class="p-6 text-center text-muted-text">{props.emptyMessage}</li>
        : props.chores.map((chore) => (
          <ChoreItem
            chore={chore}
            members={props.members}
            currentMemberId={props.currentMemberId}
            householdTimeZone={props.householdTimeZone}
            onUpdate={props.onUpdate}
            onEdit={props.onEdit}
            onReconcile={props.onReconcile}
            onToggleSuccess={props.onToggleSuccess}
          />
        ))}
    </ul>
  );
}

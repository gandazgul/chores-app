import type { Chore, Member } from "../types.ts";
import ChoreList from "./ChoreList.tsx";

interface DoneDisclosureProps {
  label: string;
  chores: Chore[];
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  forceOpen?: boolean;
  emptyMessage: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

export default function DoneDisclosure(props: DoneDisclosureProps) {
  return (
    <details
      class="border-t border-gray-200 bg-gray-50"
      open={props.forceOpen || undefined}
    >
      <summary class="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset">
        {props.label} ({props.chores.length})
      </summary>
      <ChoreList
        chores={props.chores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        emptyMessage={props.emptyMessage}
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
    </details>
  );
}

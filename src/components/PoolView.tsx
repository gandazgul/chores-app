import type { Chore, Member } from "../types.ts";
import ChoreList from "./ChoreList.tsx";
import DoneDisclosure from "./DoneDisclosure.tsx";

interface PoolViewProps {
  activeChores: Chore[];
  doneChores: Chore[];
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

export default function PoolView(props: PoolViewProps) {
  return (
    <section
      id="pool-panel"
      role="tabpanel"
      aria-labelledby="pool-tab"
      class="flex-1 min-h-0 overflow-y-auto"
    >
      <div class="p-4 border-b border-gray-100">
        <h2 class="text-xl font-bold text-primary-text">Pool</h2>
        <p class="text-sm text-muted-text mt-1">
          Unassigned chores ready for any Member to claim.
        </p>
      </div>
      <ChoreList
        chores={props.activeChores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        emptyMessage="The Pool is empty."
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
      <DoneDisclosure
        label="Done in Pool"
        chores={props.doneChores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        emptyMessage="No Done Pool chores."
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
    </section>
  );
}

import type { Chore, Member } from "../types.ts";
import ChoreList from "./ChoreList.tsx";
import DoneDisclosure from "./DoneDisclosure.tsx";

interface WhatsNextViewProps {
  activeChores: Chore[];
  doneChores: Chore[];
  dateLabel: string | null;
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

export default function WhatsNextView(props: WhatsNextViewProps) {
  return (
    <section
      id="whats-next-panel"
      role="tabpanel"
      aria-labelledby="whats-next-tab"
      class="flex-1 min-h-0 overflow-y-auto"
    >
      <div class="p-4 border-b border-gray-100">
        <h2 class="text-xl font-bold text-primary-text">What's Next</h2>
        <p class="text-sm text-muted-text mt-1">
          {props.dateLabel
            ? `Assigned chores due ${props.dateLabel}.`
            : "No assigned dated work is ready here. Use Board or Pool to see other chores."}
        </p>
      </div>
      <ChoreList
        chores={props.activeChores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        emptyMessage="No assigned dated work in the next bucket."
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
      <DoneDisclosure
        label="Done assigned to you"
        chores={props.doneChores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        emptyMessage="No Done chores assigned to you."
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
    </section>
  );
}

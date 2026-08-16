import type { Chore, Member } from "../types.ts";
import ChoreList from "./ChoreList.tsx";
import DoneDisclosure from "./DoneDisclosure.tsx";

interface BoardViewProps {
  activeChores: Chore[];
  doneChores: Chore[];
  searchQuery: string;
  onSearch: (query: string) => void;
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

export default function BoardView(props: BoardViewProps) {
  const hasQuery = () => props.searchQuery.trim().length > 0;
  return (
    <section
      id="board-panel"
      role="tabpanel"
      aria-labelledby="board-tab"
      class="flex-1 min-h-0 overflow-y-auto"
    >
      <div class="p-4 border-b border-gray-100">
        <h2 class="text-xl font-bold text-primary-text">Board</h2>
        <p class="text-sm text-muted-text mt-1">All open household chores.</p>
        <label class="block mt-4 relative">
          <span class="sr-only">Search Board chores</span>
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div class="i-mdi-magnify text-gray-400 w-5 h-5"></div>
          </div>
          <input
            type="text"
            aria-label="Search Board chores"
            placeholder="Search Board chores..."
            value={props.searchQuery}
            onInput={(event) => props.onSearch(event.currentTarget.value)}
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
          />
        </label>
      </div>
      <ChoreList
        chores={props.activeChores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        emptyMessage={hasQuery()
          ? "No open chores match your Board search."
          : "No open chores on the Board."}
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
      <DoneDisclosure
        label={hasQuery()
          ? "Done matching Board search"
          : "Done household chores"}
        chores={props.doneChores}
        members={props.members}
        currentMemberId={props.currentMemberId}
        householdTimeZone={props.householdTimeZone}
        forceOpen={hasQuery() && props.doneChores.length > 0}
        emptyMessage={hasQuery()
          ? "No Done chores match your Board search."
          : "No Done household chores."}
        onUpdate={props.onUpdate}
        onEdit={props.onEdit}
        onReconcile={props.onReconcile}
        onToggleSuccess={props.onToggleSuccess}
      />
    </section>
  );
}

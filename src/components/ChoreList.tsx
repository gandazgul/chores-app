// deno-lint-ignore-file jsx-key -- Solid renders local arrays with `.map()` to preserve the existing list pattern.
import type { Chore, Member } from "../types.ts";
import ChoreItem from "./ChoreItem.tsx";

interface ChoreListProps {
  chores: Chore[];
  searchQuery: string;
  onSearch: (query: string) => void;
  members: Member[];
  currentMemberId: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
}

export default function ChoreList(props: ChoreListProps) {
  return (
    <div class="w-full h-full min-h-0 flex flex-col">
      <div class="w-full h-18 shrink-0 p-4 border-b border-gray-100 flex gap-4 items-center">
        <div class="relative flex-grow">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div class="i-mdi-magnify text-gray-400 w-5 h-5"></div>
          </div>
          <input
            type="text"
            aria-label="Search chores"
            placeholder="Search chores..."
            value={props.searchQuery}
            onInput={(event) => props.onSearch(event.currentTarget.value)}
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
          />
        </div>
      </div>

      <ul class="w-full flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100">
        {props.chores.length === 0
          ? (
            <li class="p-8 text-center text-muted-text">
              {props.searchQuery
                ? "No chores match your search."
                : "No chores found."}
            </li>
          )
          : props.chores.map((chore) => (
            <ChoreItem
              chore={chore}
              members={props.members}
              currentMemberId={props.currentMemberId}
              onUpdate={props.onUpdate}
              onEdit={props.onEdit}
              onReconcile={props.onReconcile}
            />
          ))}
      </ul>
    </div>
  );
}

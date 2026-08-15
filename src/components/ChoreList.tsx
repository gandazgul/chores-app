// deno-lint-ignore-file jsx-key -- Solid renders this local array with `.map()` to preserve the existing list pattern.
import { createMemo, createSignal } from "solid-js";
import Fuse from "fuse.js";
import type { Chore } from "../types.ts";
import ChoreItem from "./ChoreItem.tsx";

interface ChoreListProps {
  initialChores?: Chore[];
}

export default function ChoreList(props: ChoreListProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const chores = () => props.initialChores || [];

  const fuse = new Fuse(chores(), {
    keys: ["title", "description"],
    threshold: 0.3,
  });

  const filteredChores = createMemo(() => {
    if (!searchQuery().trim()) {
      return chores();
    }
    const results = fuse.search(searchQuery());
    return results.map((result) => result.item);
  });

  return (
    <div class="flex flex-col flex-1">
      <div class="p-4 border-b border-gray-100 flex gap-4 items-center">
        <div class="relative flex-grow">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div class="i-mdi-magnify text-gray-400 w-5 h-5"></div>
          </div>
          <input
            type="text"
            placeholder="Search chores..."
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
          />
        </div>
      </div>

      <ul class="divide-y divide-gray-100 flex-grow">
        {filteredChores().length === 0
          ? (
            <li class="p-8 text-center text-muted-text">
              {searchQuery()
                ? "No chores match your search."
                : "No chores found."}
            </li>
          )
          : (
            filteredChores().map((chore) => <ChoreItem chore={chore} />)
          )}
      </ul>
    </div>
  );
}

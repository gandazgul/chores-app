/** @jsxImportSource solid-js */
import { createMemo, createSignal } from "solid-js";
import Fuse from "fuse.js";
import ChoreItem from "./ChoreItem.jsx";

/**
 * @param {Object} props
 * @param {any[]} [props.initialChores]
 */
export default function ChoreList(props) {
  const [searchQuery, setSearchQuery] = createSignal("");

  const fuse = new Fuse(props.initialChores || [], {
    keys: ["title", "description"],
    threshold: 0.3,
  });

  const filteredChores = createMemo(() => {
    if (!searchQuery().trim()) {
      return props.initialChores || [];
    }
    const results = fuse.search(searchQuery());
    return results.map((result) => result.item);
  });

  return (
    <div class="flex flex-col h-full">
      <div class="p-4 border-b border-gray-100 flex gap-4 items-center">
        <div class="relative flex-grow">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div class="i-mdi-magnify text-gray-400 w-5 h-5"></div>
          </div>
          <input
            type="text"
            placeholder="Search chores..."
            value={searchQuery()}
            /** @param {any} e */
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
          />
        </div>
      </div>

      <ul class="divide-y divide-gray-100 flex-grow overflow-y-auto">
        {filteredChores().length === 0
          ? (
            <li class="p-8 text-center text-muted-text">
              {searchQuery()
                ? "No chores match your search."
                : "No chores found."}
            </li>
          )
          : (
            filteredChores().map((/** @type {any} */ chore) => (
              <ChoreItem chore={chore} />
            ))
          )}
      </ul>
    </div>
  );
}

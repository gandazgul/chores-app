export type ChoreView = "whats-next" | "board" | "pool";

interface ViewTabsProps {
  activeView: ChoreView;
  onSelect: (view: ChoreView) => void;
}

const tabs: Array<{ id: ChoreView; label: string }> = [
  { id: "whats-next", label: "What's Next" },
  { id: "board", label: "Board" },
  { id: "pool", label: "Pool" },
];

export default function ViewTabs(props: ViewTabsProps) {
  return (
    <div
      class="px-4 pt-4 border-b border-gray-200 bg-white"
      role="tablist"
      aria-label="Chore views"
    >
      <div class="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const selected = props.activeView === tab.id;
          return (
            <button
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tab.id}-panel`}
              tabindex={selected ? 0 : -1}
              onClick={() => props.onSelect(tab.id)}
              onKeyDown={(event) => {
                if (
                  event.key !== "ArrowRight" && event.key !== "ArrowLeft"
                ) return;
                event.preventDefault();
                const currentIndex = tabs.findIndex((item) =>
                  item.id === props.activeView
                );
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const next =
                  tabs[(currentIndex + offset + tabs.length) % tabs.length];
                props.onSelect(next.id);
              }}
              class={`px-4 py-2 text-sm font-semibold border border-b-0 rounded-t-sm rounded-b-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                selected
                  ? "bg-[#e6f3f5] border-[#c7e3e8] text-primary-text"
                  : "bg-white border-gray-200 text-muted-text hover:text-primary-text hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

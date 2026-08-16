import { createMemo, createSignal } from "solid-js";
import Fuse from "fuse.js";
import type { Chore, Member } from "../types.ts";
import { selectWhatsNextChores } from "../utils/householdTime.ts";
import BoardView from "./BoardView.tsx";
import { ChoreModal, type ChoreModalMode } from "./ChoreModal.tsx";
import PoolView from "./PoolView.tsx";
import ViewTabs, { type ChoreView } from "./ViewTabs.tsx";
import WhatsNextView from "./WhatsNextView.tsx";

interface ChoreManagerProps {
  initialChores: Chore[];
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
}

function isOpen(chore: Chore): boolean {
  return chore.status === "open";
}

function isCompleted(chore: Chore): boolean {
  return chore.status === "completed";
}

function sortByDueDate(chores: Chore[]): Chore[] {
  return [...chores].sort((left, right) => {
    const leftTime = left.due_date
      ? new Date(left.due_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightTime = right.due_date
      ? new Date(right.due_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || left.title.localeCompare(right.title);
  });
}

function dateKeyLabel(dateKey: string | null): string | null {
  if (!dateKey) return null;
  return new Intl.DateTimeFormat([], { dateStyle: "medium", timeZone: "UTC" })
    .format(
      new Date(`${dateKey}T12:00:00.000Z`),
    );
}

export default function ChoreManager(props: ChoreManagerProps) {
  const [chores, setChores] = createSignal<Chore[]>(props.initialChores);
  const [activeView, setActiveView] = createSignal<ChoreView>("whats-next");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [localCompletedIds, setLocalCompletedIds] = createSignal<Set<string>>(
    new Set(),
  );
  const [modalMode, setModalMode] = createSignal<ChoreModalMode | null>(null);
  const [selectedChore, setSelectedChore] = createSignal<Chore | null>(null);
  const [returnFocusTo, setReturnFocusTo] = createSignal<HTMLElement | null>(
    null,
  );

  const fuse = createMemo(() =>
    new Fuse(chores(), {
      keys: ["title", "description"],
      threshold: 0.3,
    })
  );

  const boardMatches = createMemo(() => {
    const query = searchQuery().trim();
    if (!query) return chores();
    return fuse().search(query).map((result) => result.item);
  });

  const retainedIds = () => localCompletedIds();
  const isRetained = (chore: Chore) => retainedIds().has(chore.id);
  const isActiveRow = (chore: Chore) => isOpen(chore) || isRetained(chore);
  const isDoneRow = (chore: Chore) => isCompleted(chore) && !isRetained(chore);

  const whatsNextSelection = createMemo(() => {
    const candidates = chores().map((chore) =>
      isRetained(chore) ? { ...chore, status: "open" as const } : chore
    );
    return selectWhatsNextChores(
      candidates,
      props.currentMemberId,
      new Date(),
      props.householdTimeZone,
    );
  });

  const whatsNextActive = createMemo(() => whatsNextSelection().chores);
  const whatsNextDone = createMemo(() =>
    sortByDueDate(
      chores().filter((chore) =>
        isDoneRow(chore) && chore.assignee_id === props.currentMemberId
      ),
    )
  );
  const boardActive = createMemo(() =>
    sortByDueDate(boardMatches().filter(isActiveRow))
  );
  const boardDone = createMemo(() =>
    sortByDueDate(boardMatches().filter(isDoneRow))
  );
  const poolActive = createMemo(() =>
    sortByDueDate(
      chores().filter((chore) =>
        isActiveRow(chore) && chore.assignee_id === null
      ),
    )
  );
  const poolDone = createMemo(() =>
    sortByDueDate(
      chores().filter((chore) =>
        isDoneRow(chore) && chore.assignee_id === null
      ),
    )
  );

  const openCreate = (event: MouseEvent) => {
    setReturnFocusTo(event.currentTarget as HTMLElement);
    setSelectedChore(null);
    setModalMode("create");
  };

  const openEdit = (chore: Chore, opener: HTMLElement) => {
    setReturnFocusTo(opener);
    setSelectedChore(chore);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedChore(null);
    queueMicrotask(() => returnFocusTo()?.focus());
  };

  const upsertChore = (chore: Chore) => {
    setChores((current) => {
      const index = current.findIndex((item) => item.id === chore.id);
      if (index === -1) return [chore, ...current];
      const next = current.slice();
      next[index] = chore;
      return next;
    });
  };

  const removeChore = (id: string) => {
    setLocalCompletedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setChores((current) => current.filter((item) => item.id !== id));
  };

  const reconcileChores = async () => {
    const response = await fetch("/api/chores");
    if (!response.ok) return;
    setChores(await response.json() as Chore[]);
  };

  const recordToggleSuccess = (previous: Chore, updated: Chore) => {
    setLocalCompletedIds((current) => {
      const next = new Set(current);
      if (previous.status === "open" && updated.status === "completed") {
        next.add(updated.id);
      }
      if (previous.status === "completed" && updated.status === "open") {
        next.delete(updated.id);
      }
      return next;
    });
  };

  const sharedViewProps = {
    members: props.members,
    currentMemberId: props.currentMemberId,
    householdTimeZone: props.householdTimeZone,
    onUpdate: upsertChore,
    onEdit: openEdit,
    onReconcile: reconcileChores,
    onToggleSuccess: recordToggleSuccess,
  };

  return (
    <div class="w-full max-w-none h-full min-h-0 flex flex-col">
      <header class="w-full max-w-none shrink-0 bg-[#e6f3f5] border-b border-[#c7e3e8] shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3 min-w-0 flex-1 basis-[13.75rem]">
          <img
            src="/icon.png"
            alt="Tow logo"
            class="w-8 h-8 rounded-lg shadow-sm flex-shrink-0"
          />
          <div class="min-w-0">
            <h1 class="text-2xl font-bold text-primary-text leading-tight">
              Tow
            </h1>
            <p class="text-primary text-sm tracking-wide font-semibold leading-tight">
              STEADY HOUSEHOLD MANAGEMENT
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          class="bg-primary text-white px-4 py-2 rounded-sm shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-base flex-1 basis-[8.75rem] max-w-[13.75rem]"
        >
          <div class="i-mdi-plus w-5 h-5"></div>
          New Chore
        </button>
      </header>

      <div class="w-full max-w-none flex-1 min-h-0 flex flex-col bg-white border-b border-gray-200">
        <ViewTabs activeView={activeView()} onSelect={setActiveView} />
        {activeView() === "whats-next" && (
          <WhatsNextView
            activeChores={whatsNextActive()}
            doneChores={whatsNextDone()}
            dateLabel={dateKeyLabel(whatsNextSelection().dateKey)}
            {...sharedViewProps}
          />
        )}
        {activeView() === "board" && (
          <BoardView
            activeChores={boardActive()}
            doneChores={boardDone()}
            searchQuery={searchQuery()}
            onSearch={setSearchQuery}
            {...sharedViewProps}
          />
        )}
        {activeView() === "pool" && (
          <PoolView
            activeChores={poolActive()}
            doneChores={poolDone()}
            {...sharedViewProps}
          />
        )}
      </div>

      <ChoreModal
        mode={modalMode()}
        chore={selectedChore()}
        members={props.members}
        currentMemberId={props.currentMemberId}
        onClose={closeModal}
        onSaved={(chore) => {
          upsertChore(chore);
          closeModal();
        }}
        onDeleted={(id) => {
          removeChore(id);
          closeModal();
        }}
      />
    </div>
  );
}

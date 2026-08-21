import { createMemo, createSignal } from "solid-js";
import Fuse from "fuse.js";
import type { Chore, Member } from "../types.ts";
import ChoreList from "./ChoreList.tsx";
import { ChoreModal, type ChoreModalMode } from "./ChoreModal.tsx";

interface ChoreManagerProps {
  initialChores: Chore[];
  members: Member[];
  currentMemberId: string;
}

export default function ChoreManager(props: ChoreManagerProps) {
  const [chores, setChores] = createSignal<Chore[]>(props.initialChores);
  const [searchQuery, setSearchQuery] = createSignal("");
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

  const filteredChores = createMemo(() => {
    const query = searchQuery().trim();
    if (!query) return chores();
    return fuse().search(query).map((result) => result.item);
  });

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
      if (chore.status !== "open") {
        return current.filter((item) => item.id !== chore.id);
      }
      const index = current.findIndex((item) => item.id === chore.id);
      if (index === -1) return [chore, ...current];
      const next = current.slice();
      next[index] = chore;
      return next;
    });
  };

  const removeChore = (id: string) => {
    setChores((current) => current.filter((item) => item.id !== id));
  };

  const reconcileChores = async () => {
    const response = await fetch("/api/chores");
    if (!response.ok) return;
    setChores(await response.json() as Chore[]);
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
        <ChoreList
          chores={filteredChores()}
          searchQuery={searchQuery()}
          onSearch={setSearchQuery}
          members={props.members}
          currentMemberId={props.currentMemberId}
          onUpdate={upsertChore}
          onEdit={openEdit}
          onReconcile={reconcileChores}
        />
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

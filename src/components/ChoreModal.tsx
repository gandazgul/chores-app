import { createEffect, createSignal, Show } from "solid-js";
import type { Chore, Member } from "../types.ts";

export type ChoreModalMode = "create" | "edit";

interface ChoreModalProps {
  mode: ChoreModalMode | null;
  chore: Chore | null;
  members: Member[];
  currentMemberId: string;
  onClose: () => void;
  onSaved: (chore: Chore) => void;
  onDeleted: (id: string) => void;
}

function toLocalDateTimeValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${
    pad(date.getDate())
  }T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDateTimeValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rruleValue(chore: Chore | null): string {
  if (!chore) return "";
  return typeof chore.recurrence === "object" && chore.recurrence !== null
    ? chore.recurrence.rrule
    : "";
}

export function ChoreModal(props: ChoreModalProps) {
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [rrule, setRrule] = createSignal("");
  const [dueDate, setDueDate] = createSignal("");
  const [assigneeId, setAssigneeId] = createSignal<string | null>(
    props.currentMemberId,
  );
  const [remindUntilDone, setRemindUntilDone] = createSignal(true);
  const [error, setError] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  let titleInput: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.mode === "create") {
      setTitle("");
      setDescription("");
      setRrule("");
      setDueDate("");
      setAssigneeId(props.currentMemberId);
      setRemindUntilDone(true);
      setError("");
      setConfirmDelete(false);
      queueMicrotask(() => titleInput?.focus());
    } else if (props.mode === "edit" && props.chore) {
      setTitle(props.chore.title);
      setDescription(props.chore.description ?? "");
      setRrule(rruleValue(props.chore));
      setDueDate(toLocalDateTimeValue(props.chore.due_date));
      setAssigneeId(props.chore.assignee_id);
      setRemindUntilDone(props.chore.remind_until_done === 1);
      setError("");
      setConfirmDelete(false);
      queueMicrotask(() => titleInput?.focus());
    }
  });

  const handleClose = () => {
    if (isSaving() || isDeleting()) return;
    props.onClose();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
    }
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!title().trim()) {
      setError("Title is required");
      return;
    }

    const parsedDueDate = dueDate() ? fromLocalDateTimeValue(dueDate()) : null;
    if (dueDate() && !parsedDueDate) {
      setError("Due date and time is invalid");
      return;
    }

    setIsSaving(true);
    setError("");
    const body = {
      title: title().trim(),
      description: description().trim() || null,
      rrule: rrule() || null,
      dueDate: parsedDueDate,
      assigneeId: assigneeId(),
      remindUntilDone: remindUntilDone(),
    };

    try {
      const response = await fetch(
        props.mode === "edit" && props.chore
          ? `/api/chores/${props.chore.id}`
          : "/api/chores",
        {
          method: props.mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as {
          error?: string;
        };
        throw new Error(payload.error || "Save failed");
      }
      props.onSaved(await response.json() as Chore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!props.chore) return;
    if (!confirmDelete()) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/chores/${props.chore.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as {
          error?: string;
        };
        throw new Error(payload.error || "Delete failed");
      }
      props.onDeleted(props.chore.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Show when={props.mode}>
      <div
        class="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          aria-label="Close chore dialog"
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity cursor-default"
          onClick={handleClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chore-dialog-title"
          class="bg-white shadow-xl w-full h-full sm:w-[90%] sm:max-w-[32rem] sm:h-auto sm:max-h-[90%] relative z-10 overflow-y-auto"
          style="min-height: min(32rem, 100%);"
        >
          <div class="flex justify-between items-center p-4 border-b border-gray-100 sticky top-0 bg-white">
            <h3
              id="chore-dialog-title"
              class="text-lg font-semibold text-primary-text"
            >
              {props.mode === "edit" ? "Edit Chore" : "Add New Chore"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              class="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close"
            >
              <div class="i-mdi-close w-5 h-5"></div>
            </button>
          </div>

          <form onSubmit={handleSubmit} class="p-4 flex flex-col gap-4">
            {error() && (
              <div class="bg-red-50 text-red-600 p-3 text-sm" role="alert">
                {error()}
              </div>
            )}

            <div>
              <label
                for="title"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Title *
              </label>
              <input
                ref={titleInput}
                type="text"
                id="title"
                name="title"
                value={title()}
                onInput={(event) => setTitle(event.currentTarget.value)}
                placeholder="e.g. Wash dishes"
                class="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                required
              />
            </div>

            <div>
              <label
                for="description"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={description()}
                onInput={(event) => setDescription(event.currentTarget.value)}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label
                for="rrule"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Recurrence
              </label>
              <select
                id="rrule"
                name="rrule"
                value={rrule()}
                onChange={(event) => setRrule(event.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white"
              >
                <option value="">Once (No recurrence)</option>
                <option value="FREQ=DAILY">Daily</option>
                <option value="FREQ=WEEKLY">Weekly</option>
                <option value="FREQ=MONTHLY">Monthly</option>
              </select>
            </div>

            <div>
              <label
                for="dueDate"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Due date and time
              </label>
              <input
                id="dueDate"
                name="dueDate"
                type="datetime-local"
                value={dueDate()}
                onInput={(event) => setDueDate(event.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label
                for="assigneeId"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Assignment
              </label>
              <select
                id="assigneeId"
                name="assigneeId"
                value={assigneeId() ?? ""}
                onChange={(event) =>
                  setAssigneeId(event.currentTarget.value || null)}
                class="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white"
              >
                <option value="">Pool</option>
                {props.members.map((member) => (
                  <option value={member.id}>{member.name || "Member"}</option>
                ))}
              </select>
            </div>

            <label class="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                name="remindUntilDone"
                checked={remindUntilDone()}
                onChange={(event) =>
                  setRemindUntilDone(event.currentTarget.checked)}
                class="mt-1"
              />
              <span>
                <span class="font-medium text-primary-text">
                  Allow push notifications for this chore
                </span>
                <span class="block text-gray-500">
                  Turn this off to stop future Push Notifications for this
                  Chore.
                </span>
              </span>
            </label>

            <div class="flex flex-col sm:flex-row sm:justify-between gap-3 mt-4">
              <Show when={props.mode === "edit"}>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting() || isSaving()}
                  class={`px-4 py-2 border rounded-sm transition-colors ${
                    confirmDelete()
                      ? "border-red-600 bg-red-50 text-red-700"
                      : "border-red-200 text-red-600 hover:bg-red-50"
                  } disabled:opacity-50`}
                >
                  {confirmDelete() ? "Confirm delete" : "Delete"}
                </button>
              </Show>
              <div class="flex justify-end gap-3 sm:ml-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving() || isDeleting()}
                  class="px-4 py-2 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving() || isDeleting()}
                  class="bg-primary text-white px-4 py-2 rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving() ? "Saving..." : "Save Chore"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}

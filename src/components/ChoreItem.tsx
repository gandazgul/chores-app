import { createEffect, createSignal } from "solid-js";
import type { Chore, Member } from "../types.ts";
import { formatHouseholdDueDate } from "../utils/householdTime.ts";

interface ChoreItemProps {
  chore: Chore;
  members: Member[];
  currentMemberId: string;
  householdTimeZone: string;
  onUpdate: (chore: Chore) => void;
  onEdit: (chore: Chore, opener: HTMLElement) => void;
  onReconcile: () => Promise<void>;
  onToggleSuccess: (previous: Chore, updated: Chore) => void;
}

function getRRuleFrequency(rrule: string) {
  if (!rrule) return "Recurring";
  const match = rrule.match(/FREQ=([^;]+)/);
  return match ? match[1] : "Recurring";
}

function recurrence(chore: Chore) {
  return typeof chore.recurrence === "object" ? chore.recurrence : null;
}

export default function ChoreItem(props: ChoreItemProps) {
  const [isDone, setIsDone] = createSignal(!!props.chore.done);
  const [isLoading, setIsLoading] = createSignal(false);
  const [assignmentLoading, setAssignmentLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  createEffect(() => setIsDone(!!props.chore.done));

  const memberName = (id: string | null) => {
    if (!id) return "Pool";
    return props.members.find((member) => member.id === id)?.name || "Member";
  };

  const handleToggle = async () => {
    if (isLoading()) return;

    const previousState = isDone();
    const newState = !previousState;

    setIsDone(newState);
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/chores/${props.chore.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: newState }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as {
          error?: string;
        };
        throw new Error(body.error || "Failed to update chore");
      }

      const updatedChore = await response.json() as Chore;
      props.onUpdate(updatedChore);
      props.onToggleSuccess(props.chore, updatedChore);
      if (newState) await props.onReconcile();
    } catch (err) {
      setIsDone(previousState);
      setError(err instanceof Error ? err.message : "Failed to update");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const assignmentCommand = (targetId: string | null) => {
    if (props.chore.assignee_id === null) {
      if (targetId === null) return null;
      return targetId === props.currentMemberId
        ? { action: "claim" }
        : { action: "assign", assigneeId: targetId };
    }
    if (targetId === null) return { action: "release" };
    if (targetId === props.chore.assignee_id) return null;
    return { action: "reassign", assigneeId: targetId };
  };

  const runAssignment = async (targetId: string | null) => {
    if (assignmentLoading()) return;
    const command = assignmentCommand(targetId);
    if (!command) return;

    const previous = props.chore;
    const optimistic: Chore = {
      ...props.chore,
      assignee_id: targetId,
      unassigned_since: targetId === null ? new Date().toISOString() : null,
    };
    props.onUpdate(optimistic);
    setAssignmentLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/chores/${props.chore.id}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as {
          error?: string;
        };
        props.onUpdate(previous);
        if (response.status === 409) {
          await props.onReconcile();
          throw new Error(body.error || "Assignment changed. List refreshed.");
        }
        throw new Error(body.error || "Assignment failed");
      }
      props.onUpdate(await response.json() as Chore);
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes("List refreshed")) {
        props.onUpdate(previous);
      }
      setError(err instanceof Error ? err.message : "Assignment failed");
      console.error(err);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const due = () =>
    formatHouseholdDueDate(props.chore.due_date, props.householdTimeZone);
  const currentRecurrence = () => recurrence(props.chore);

  return (
    <li
      class={`p-4 transition-colors ${
        isDone() ? "bg-gray-50" : "hover:bg-gray-50"
      }`}
    >
      <div class="flex items-start gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading()}
          class={`w-7 h-7 mt-1 rounded-sm border-2 flex-shrink-0 cursor-pointer transition-colors flex items-center justify-center ${
            isDone()
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-primary"
          } ${isLoading() ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={isDone() ? "Mark as undone" : "Mark as done"}
        >
          {isDone() && <div class="i-mdi-check w-4 h-4" />}
        </button>

        <div class="min-w-0 flex-1">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div class="min-w-0">
              <h4
                class={`font-medium transition-all ${
                  isDone()
                    ? "line-through text-muted-text"
                    : "text-primary-text"
                }`}
              >
                {props.chore.title}
              </h4>
              {props.chore.description && (
                <p class="text-sm text-muted-text mt-0.5 break-words">
                  {props.chore.description}
                </p>
              )}
              <div class="flex flex-wrap gap-2 mt-2 text-xs">
                {due() && (
                  <span class={isDone() ? "text-gray-400" : "text-muted-text"}>
                    Due: {due()}
                  </span>
                )}
                {currentRecurrence()?.rrule && (
                  <span class="px-2 py-0.5 bg-gray-100 text-gray-600 flex items-center gap-1">
                    <div class="i-mdi-sync w-3 h-3"></div>
                    {getRRuleFrequency(currentRecurrence()?.rrule ?? "")}
                  </span>
                )}
                <span class="px-2 py-0.5 bg-[#e6f3f5] text-primary flex items-center gap-1">
                  <div class="i-mdi-account w-3 h-3"></div>
                  {props.chore.assignee_id === null
                    ? "Pool"
                    : `Assigned: ${memberName(props.chore.assignee_id)}`}
                </span>
              </div>
              {error() && (
                <p class="text-xs text-red-600 mt-2" role="alert">
                  {error()}
                </p>
              )}
            </div>

            <div class="flex flex-wrap items-center gap-2 sm:justify-end flex-shrink-0">
              {props.chore.assignee_id === null
                ? (
                  <button
                    type="button"
                    onClick={() => runAssignment(props.currentMemberId)}
                    disabled={assignmentLoading()}
                    class="px-3 py-1.5 text-sm border border-primary text-primary hover:bg-[#e6f3f5] disabled:opacity-50"
                  >
                    Claim
                  </button>
                )
                : (
                  <button
                    type="button"
                    onClick={() => runAssignment(null)}
                    disabled={assignmentLoading()}
                    class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Release
                  </button>
                )}
              <select
                aria-label={`${
                  props.chore.assignee_id === null ? "Assign" : "Reassign"
                } ${props.chore.title}`}
                value={props.chore.assignee_id ?? ""}
                disabled={assignmentLoading()}
                onChange={(event) =>
                  runAssignment(event.currentTarget.value || null)}
                class="px-2 py-1.5 text-sm border border-gray-300 bg-white max-w-36"
              >
                <option value="">Pool</option>
                {props.members.map((member) => (
                  <option value={member.id}>{member.name || "Member"}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={(event) =>
                  props.onEdit(props.chore, event.currentTarget)}
                class="px-3 py-1.5 text-sm bg-gray-100 text-primary-text hover:bg-gray-200"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

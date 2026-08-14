import { createSignal } from "solid-js";
import type { Chore } from "../types.ts";

interface ChoreItemProps {
  chore: Chore;
  onUpdate?: (chore: Chore) => void;
}

export default function ChoreItem(props: ChoreItemProps) {
  const [isDone, setIsDone] = createSignal(!!props.chore.done);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal("");

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ done: newState }),
      });

      if (!response.ok) {
        throw new Error("Failed to update chore");
      }

      const updatedChore = await response.json() as Chore;
      setIsDone(!!updatedChore.done);

      if (props.onUpdate) {
        props.onUpdate(updatedChore);
      }
    } catch (err) {
      setIsDone(previousState);
      setError("Failed to update");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRRuleFrequency = (rrule: string) => {
    if (!rrule) return "Recurring";
    const match = rrule.match(/FREQ=([^;]+)/);
    return match ? match[1] : "Recurring";
  };

  const recurrence = () =>
    typeof props.chore.recurrence === "object" ? props.chore.recurrence : null;

  return (
    <li
      class={`p-4 flex items-center justify-between transition-colors ${
        isDone() ? "bg-gray-50" : "hover:bg-gray-50"
      }`}
    >
      <div class="flex items-center gap-4 w-full">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading()}
          class={`w-6 h-6 rounded-sm border-2 flex-shrink-0 cursor-pointer transition-colors flex items-center justify-center
            ${
            isDone()
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-primary"
          }
            ${isLoading() ? "opacity-50 cursor-not-allowed" : ""}
          `}
          aria-label={isDone() ? "Mark as undone" : "Mark as done"}
        >
          {isDone() && <div class="i-mdi-check w-4 h-4" />}
        </button>
        <div class="flex-grow">
          <h4
            class={`font-medium transition-all ${
              isDone() ? "line-through text-muted-text" : "text-primary-text"
            }`}
          >
            {props.chore.title}
          </h4>
          {props.chore.description && (
            <p class="text-sm text-muted-text mt-0.5">
              {props.chore.description}
            </p>
          )}
          {error() && <p class="text-xs text-red-500 mt-1">{error()}</p>}
        </div>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
        {props.chore.due_date && (
          <span
            class={`text-xs ${isDone() ? "text-gray-400" : "text-muted-text"}`}
          >
            Due: {new Date(props.chore.due_date).toLocaleDateString()}
          </span>
        )}
        {recurrence()?.rrule && (
          <span
            class={`text-xs px-2 py-0.5 flex items-center gap-1
            ${
              isDone()
                ? "bg-gray-100 text-gray-400"
                : "bg-gray-100 text-gray-600"
            }
          `}
          >
            <div class="i-mdi-sync w-3 h-3"></div>
            {getRRuleFrequency(recurrence()?.rrule ?? "")}
          </span>
        )}
      </div>
    </li>
  );
}

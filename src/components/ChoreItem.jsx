/** @jsxImportSource solid-js */
import { createSignal } from "solid-js";

/**
 * @param {Object} props
 * @param {any} props.chore
 * @param {Function} [props.onUpdate]
 */
export default function ChoreItem(props) {
  const [isDone, setIsDone] = createSignal(!!props.chore.done);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleToggle = async () => {
    if (isLoading()) return;

    const previousState = isDone();
    const newState = !previousState;

    // Optimistic UI update
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

      const updatedChore = await response.json();
      // Server might have advanced the due date and set done to false for recurring chores
      setIsDone(!!updatedChore.done);

      // We might want to trigger a refresh here if the server completely changed the chore,
      // but for now, we just rely on the API response to set the correct isDone state.
      // If the parent component needs to re-sort or re-render, we'd need a callback.
      if (props.onUpdate) {
        props.onUpdate(updatedChore);
      }
    } catch (err) {
      // Revert optimistic update
      setIsDone(previousState);
      setError("Failed to update");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @param {string} rrule
   */
  const getRRuleFrequency = (rrule) => {
    if (!rrule) return "Recurring";
    const match = rrule.match(/FREQ=([^;]+)/);
    return match ? match[1] : "Recurring";
  };

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
          class={`w-6 h-6 rounded-full border-2 flex-shrink-0 cursor-pointer transition-colors flex items-center justify-center
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
        {props.chore.recurrence?.rrule && (
          <span
            class={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1
            ${
              isDone()
                ? "bg-gray-100 text-gray-400"
                : "bg-gray-100 text-gray-600"
            }
          `}
          >
            <div class="i-mdi-sync w-3 h-3"></div>
            {getRRuleFrequency(props.chore.recurrence.rrule)}
          </span>
        )}
      </div>
    </li>
  );
}

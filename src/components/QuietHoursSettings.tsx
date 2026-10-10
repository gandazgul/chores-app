import { createSignal } from "solid-js";
import type { QuietHoursSettings as Settings } from "../notifications/quietHours.ts";

export default function QuietHoursSettings(props: {
  initialSettings: Settings;
  timeZone: string;
}) {
  const [enabled, setEnabled] = createSignal(props.initialSettings.enabled);
  const [start, setStart] = createSignal(props.initialSettings.start);
  const [end, setEnd] = createSignal(props.initialSettings.end);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [status, setStatus] = createSignal("");

  const changed = () => {
    setError("");
    setStatus("");
  };
  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    changed();
    if (enabled() && start() === end()) {
      setError(
        "Choose different start and end times, or turn quiet hours off.",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/users/me/quiet-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: enabled(),
          start: start(),
          end: end(),
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      setStatus(enabled() ? "Quiet hours saved." : "Quiet hours turned off.");
    } catch {
      setError(
        "Could not save quiet hours. Your changes are still here; please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="quiet-hours-title"
      class="bg-white border border-gray-200 p-4 sm:p-6"
    >
      <h2
        id="quiet-hours-title"
        class="text-xl font-semibold text-primary-text"
      >
        Quiet hours
      </h2>
      <p id="quiet-hours-help" class="text-sm text-muted-text mt-2">
        Pause your reminders during these hours. Unfinished chores can remind
        you again afterward. This only changes your notifications.
      </p>
      <p id="quiet-hours-timezone" class="text-sm text-primary-text mt-2">
        Timezone: {props.timeZone} (household time)
      </p>
      <form onSubmit={save} class="mt-5 flex flex-col gap-4">
        <fieldset
          disabled={saving()}
          class="flex flex-col gap-4"
          aria-describedby="quiet-hours-help quiet-hours-timezone"
        >
          <label class="flex items-center gap-3 min-h-11 cursor-pointer text-primary-text">
            <input
              type="checkbox"
              checked={enabled()}
              onChange={(event) => {
                setEnabled(event.currentTarget.checked);
                changed();
              }}
              class="w-5 h-5 accent-primary focus-visible:outline-2 focus-visible:outline-primary"
            />
            Enable quiet hours
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="quiet-start"
                class="block text-sm font-medium text-primary-text mb-1"
              >
                Pause reminders at
              </label>
              <input
                id="quiet-start"
                type="time"
                required
                disabled={!enabled()}
                value={start()}
                onInput={(event) => {
                  setStart(event.currentTarget.value);
                  changed();
                }}
                class="w-full min-h-11 p-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
            </div>
            <div>
              <label
                for="quiet-end"
                class="block text-sm font-medium text-primary-text mb-1"
              >
                Resume reminders at
              </label>
              <input
                id="quiet-end"
                type="time"
                required
                disabled={!enabled()}
                value={end()}
                onInput={(event) => {
                  setEnd(event.currentTarget.value);
                  changed();
                }}
                class="w-full min-h-11 p-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
            </div>
          </div>
        </fieldset>
        {error() && <p role="alert" class="text-red-700 text-sm">{error()}</p>}
        <p role="status" class="text-primary-text text-sm" aria-live="polite">
          {status()}
        </p>
        <button
          type="submit"
          disabled={saving()}
          class="self-start min-h-11 bg-primary text-white px-4 py-2 rounded-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {saving() ? "Saving…" : "Save quiet hours"}
        </button>
      </form>
    </section>
  );
}

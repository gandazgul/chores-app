import { createSignal } from "solid-js";

interface NotificationSettingsProps {
  initialGotifyConfigured: boolean;
}

interface TokenStateResponse {
  gotifyConfigured?: boolean;
  error?: string;
}

export default function NotificationSettings(props: NotificationSettingsProps) {
  const [gotifyConfigured, setGotifyConfigured] = createSignal(
    props.initialGotifyConfigured,
  );
  const [token, setToken] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [error, setError] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [isClearing, setIsClearing] = createSignal(false);
  let tokenInput: HTMLInputElement | undefined;

  const handleSave = async (event: SubmitEvent) => {
    event.preventDefault();
    const replacement = token().trim();
    if (!replacement) {
      setError("Enter a Gotify Application Token.");
      setStatus("");
      queueMicrotask(() => tokenInput?.focus());
      return;
    }

    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/users/me/gotify-token", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gotifyToken: replacement }),
      });
      const payload = await response.json().catch(
        () => ({}),
      ) as TokenStateResponse;
      if (!response.ok || typeof payload.gotifyConfigured !== "boolean") {
        throw new Error("Save failed");
      }
      setGotifyConfigured(payload.gotifyConfigured);
      setToken("");
      setStatus("Notification settings saved.");
      queueMicrotask(() => tokenInput?.focus());
    } catch {
      setError("Notification settings could not be saved.");
      queueMicrotask(() => tokenInput?.focus());
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!gotifyConfigured() || isClearing()) return;
    setIsClearing(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/users/me/gotify-token", {
        method: "DELETE",
      });
      const payload = await response.json().catch(
        () => ({}),
      ) as TokenStateResponse;
      if (!response.ok || typeof payload.gotifyConfigured !== "boolean") {
        throw new Error("Clear failed");
      }
      setGotifyConfigured(payload.gotifyConfigured);
      setToken("");
      setStatus("Notification settings cleared.");
      queueMicrotask(() => tokenInput?.focus());
    } catch {
      setError("Notification settings could not be cleared.");
      queueMicrotask(() => tokenInput?.focus());
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <section
      aria-labelledby="notification-settings-title"
      class="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4"
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="notification-settings-title"
            class="text-xl font-semibold text-primary-text"
          >
            Notification Settings
          </h2>
          <p class="text-sm text-muted-text mt-1">
            Store the Gotify Application Token for your Member account.
          </p>
        </div>
        <p class="text-sm font-semibold text-primary-text" aria-live="polite">
          {gotifyConfigured() ? "Configured" : "Not configured"}
        </p>
      </div>

      {error() && (
        <div class="bg-red-50 text-red-600 p-3 text-sm" role="alert">
          {error()}
        </div>
      )}
      <p class="sr-only" role="status" aria-live="polite">
        {status()}
      </p>
      {status() && (
        <div class="bg-green-50 text-green-700 p-3 text-sm" aria-hidden="true">
          {status()}
        </div>
      )}

      <form onSubmit={handleSave} class="flex flex-col gap-4">
        <div>
          <label
            for="gotify-token"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Gotify Application Token
          </label>
          <input
            ref={tokenInput}
            id="gotify-token"
            name="gotifyToken"
            type="password"
            autocomplete="new-password"
            spellcheck={false}
            value={token()}
            onInput={(event) => setToken(event.currentTarget.value)}
            maxlength="1024"
            class="w-full p-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isSaving() || isClearing()}
            class="bg-primary text-white px-4 py-2 rounded-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isSaving()
              ? "Saving..."
              : gotifyConfigured()
              ? "Replace Token"
              : "Save Token"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!gotifyConfigured() || isSaving() || isClearing()}
            class="border border-gray-300 text-primary-text px-4 py-2 rounded-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearing() ? "Clearing..." : "Clear Token"}
          </button>
        </div>
      </form>
    </section>
  );
}

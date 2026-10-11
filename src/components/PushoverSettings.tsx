import { createSignal } from "solid-js";

interface Props {
  initialConfigured: boolean;
  serverReady: boolean;
}

export default function PushoverSettings(props: Props) {
  const [configured, setConfigured] = createSignal(props.initialConfigured);
  const [key, setKey] = createSignal("");
  const [busy, setBusy] = createSignal<"save" | "clear" | "test" | null>(null);
  const [error, setError] = createSignal("");
  const [status, setStatus] = createSignal("");

  async function perform(action: "save" | "clear" | "test") {
    if (busy()) return;
    if (action === "save" && !/^[A-Za-z0-9]{30}$/u.test(key().trim())) {
      setStatus("");
      setError(
        "Enter the 30-character user key shown in your Pushover account.",
      );
      return;
    }
    setBusy(action);
    setError("");
    setStatus("");
    try {
      const response = await fetch(
        action === "test"
          ? "/api/users/me/test-notification"
          : "/api/users/me/pushover-key",
        {
          method: action === "test"
            ? "POST"
            : action === "clear"
            ? "DELETE"
            : "PUT",
          headers: { "Content-Type": "application/json" },
          ...(action === "save"
            ? { body: JSON.stringify({ userKey: key().trim() }) }
            : {}),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error || "The request failed. Please try again.",
        );
      }
      if (action === "test") {
        if (typeof payload.message !== "string") {
          throw new Error("Invalid response. Try again.");
        }
        setStatus(payload.message);
      } else {
        if (typeof payload.pushoverConfigured !== "boolean") {
          throw new Error("Invalid response. Try again.");
        }
        setConfigured(payload.pushoverConfigured);
        setKey("");
        setStatus(
          action === "save"
            ? "Pushover connected. Send a test to check your phone."
            : "Pushover disconnected. Reminders will not reach your phone until you reconnect.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The request failed. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="pushover-title"
      class="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h2 id="pushover-title" class="text-xl font-semibold text-primary-text">
          Pushover notifications
        </h2>
        <p class="text-sm font-semibold text-primary-text" aria-live="polite">
          {configured() ? "Connected" : "Not connected"}
        </p>
      </div>
      <p class="text-sm text-muted-text">
        Receive chore reminders in the Pushover app. Copy your user key from
        {" "}
        <a
          href="https://pushover.net/"
          target="_blank"
          rel="noreferrer"
          class="text-primary underline underline-offset-2"
        >
          your Pushover account
        </a>. This connects only your Tow account.
      </p>
      {!props.serverReady && (
        <p class="bg-amber-50 text-amber-900 p-3 text-sm">
          Pushover setup on the server is not complete yet. Contact your
          household administrator to enable it.
        </p>
      )}
      {error() && (
        <p role="alert" class="bg-red-50 text-red-600 p-3 text-sm">{error()}</p>
      )}
      <p
        role="status"
        aria-live="polite"
        class={status() ? "bg-green-50 text-green-700 p-3 text-sm" : "sr-only"}
      >
        {status()}
      </p>
      <form
        class="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void perform("save");
        }}
      >
        <div>
          <label
            for="pushover-key"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Pushover user key
          </label>
          <input
            id="pushover-key"
            name="userKey"
            type="password"
            autocomplete="new-password"
            spellcheck={false}
            maxlength="30"
            value={key()}
            onInput={(event) => setKey(event.currentTarget.value)}
            disabled={!!busy() || !props.serverReady}
            aria-describedby="pushover-key-help"
            class="w-full p-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
          />
          <p id="pushover-key-help" class="mt-2 text-sm text-muted-text">
            Your saved key is never displayed. Paste a new key to replace it.
          </p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={!!busy() || !props.serverReady}
            class="min-h-11 bg-primary text-white px-4 py-2 rounded-sm shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {busy() === "save"
              ? "Connecting…"
              : configured()
              ? "Replace user key"
              : "Connect Pushover"}
          </button>
          <button
            type="button"
            onClick={() => void perform("clear")}
            disabled={!!busy() || !configured()}
            class="min-h-11 border border-gray-300 text-primary-text px-4 py-2 rounded-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy() === "clear" ? "Disconnecting…" : "Disconnect Pushover"}
          </button>
        </div>
      </form>
      <div class="border-t border-gray-200 pt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void perform("test")}
          disabled={!!busy() || !configured() || !props.serverReady}
          class="min-h-11 self-start border border-gray-300 text-primary-text px-4 py-2 rounded-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy() === "test" ? "Sending…" : "Send test notification"}
        </button>
        <p class="text-sm text-muted-text">
          The test sends immediately, even during Tow quiet hours. Pushover and
          Android sound settings still apply.
        </p>
      </div>
    </section>
  );
}

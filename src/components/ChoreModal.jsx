/** @jsxImportSource solid-js */
import { createSignal, Show } from "solid-js";

export function ChoreModal() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [rrule, setRrule] = createSignal("");
  const [error, setError] = createSignal("");

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    setTitle("");
    setDescription("");
    setRrule("");
    setError("");
  };

  /** @param {any} e */
  const handleSubmit = (e) => {
    if (!title().trim()) {
      e.preventDefault();
      setError("Title is required");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        class="bg-primary text-white px-4 py-2 rounded-md shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
      >
        <div class="i-mdi-plus w-5 h-5"></div>
        New Chore
      </button>

      <Show when={isOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleClose}
          >
          </div>

          <div class="bg-white rounded-lg shadow-xl w-full max-w-md relative z-10 overflow-hidden">
            <div class="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 class="text-lg font-semibold text-primary-text">
                Add New Chore
              </h3>
              <button
                type="button"
                onClick={handleClose}
                class="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <div class="i-mdi-close w-5 h-5"></div>
              </button>
            </div>

            <form
              method="post"
              action="/api/chores"
              onSubmit={handleSubmit}
              class="p-4 flex flex-col gap-4"
            >
              {error() && (
                <div class="bg-red-50 text-red-600 p-3 rounded text-sm">
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
                  type="text"
                  id="title"
                  name="title"
                  value={title()}
                  /** @param {any} e */
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  placeholder="e.g. Wash dishes"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                  /** @param {any} e */
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                </textarea>
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
                  /** @param {any} e */
                  onChange={(e) => setRrule(e.currentTarget.value)}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">Once (No recurrence)</option>
                  <option value="FREQ=DAILY">Daily</option>
                  <option value="FREQ=WEEKLY">Weekly</option>
                  <option value="FREQ=MONTHLY">Monthly</option>
                </select>
              </div>

              <div class="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="bg-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
                >
                  Save Chore
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </>
  );
}

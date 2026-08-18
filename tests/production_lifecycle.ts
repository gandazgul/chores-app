import { DatabaseSync } from "node:sqlite";
import { assertEquals } from "@std/assert";
import { baselineMigration } from "../src/db/migrations/0001_baseline.ts";

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface LedgerRow {
  version: number;
  name: string;
}

interface CountRow {
  count: number;
}

async function runCommand(
  command: string,
  args: string[],
  options: { check?: boolean } = {},
): Promise<CommandResult> {
  const output = await new Deno.Command(command, { args }).output();
  const result = {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
  if (options.check !== false && result.code !== 0) {
    throw new Error(
      `${command} ${
        args.join(" ")
      } failed with ${result.code}\n${result.stdout}${result.stderr}`,
    );
  }
  return result;
}

async function findDockerCli(): Promise<string> {
  const configured = Deno.env.get("DOCKER_CLI");
  const candidates = configured ? [configured] : ["docker", "podman"];

  for (const candidate of candidates) {
    try {
      const result = await runCommand(candidate, ["version"], { check: false });
      if (result.code === 0) {
        return candidate;
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  throw new Error(
    "deno task test:production-lifecycle requires docker or podman. Set DOCKER_CLI to a compatible command if needed.",
  );
}

function allocatePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function waitForHttp(port: number, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.status > 0) {
        await response.body?.cancel();
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not become ready: ${String(lastError)}`);
}

async function assertNoHttp(port: number, durationMs = 1_500) {
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(300),
      });
      await response.body?.cancel();
      throw new Error(
        `server responded with ${response.status} before migration finished`,
      );
    } catch (error) {
      if (
        error instanceof Error && error.message.includes("server responded")
      ) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function createWritableFile(path: string) {
  await Deno.writeTextFile(path, "");
  await Deno.chmod(path, 0o666);
}

function createLegacyDatabase(path: string) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  baselineMigration.up(db);
  db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(
    "legacy-user",
    "legacy@example.com",
  );
  db.prepare(
    "INSERT INTO chores (id, user_id, title, done) VALUES (?, ?, ?, ?)",
  )
    .run("legacy-chore", "legacy-user", "Legacy Chore", 0);
  db.prepare("INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)").run(
    "legacy-log",
    "legacy-chore",
  );
  db.close();
}

function createIncompatibleDatabase(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY
    );
  `);
  db.close();
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<
    { name: string }
  >).map((row) => row.name);
}

function assertMigrated(path: string, expectSentinel: boolean) {
  const db = new DatabaseSync(path);
  const ledger = db.prepare("SELECT version, name FROM schema_migrations")
    .all() as unknown as LedgerRow[];
  assertEquals(ledger, [
    { version: 1, name: "0001_baseline" },
    { version: 2, name: "0002_occurrence_resolution" },
    { version: 3, name: "0003_user_names" },
    { version: 4, name: "0004_household_assignment" },
    { version: 5, name: "0005_gotify_token" },
    { version: 6, name: "0006_notification_deliveries" },
  ]);
  assertEquals(
    columnNames(db, "chores").filter((name) =>
      [
        "status",
        "recurrence_parent_id",
        "revision",
        "assignee_id",
        "unassigned_since",
        "nag_eligible_since",
      ].includes(name)
    ),
    [
      "status",
      "recurrence_parent_id",
      "revision",
      "assignee_id",
      "unassigned_since",
      "nag_eligible_since",
    ],
  );
  assertEquals(
    columnNames(db, "chores").includes("notification_sent_at"),
    false,
  );
  assertEquals(
    columnNames(db, "notification_deliveries").includes("deliver_after"),
    true,
  );
  assertEquals(columnNames(db, "users").includes("name"), true);
  assertEquals(columnNames(db, "users").includes("picture"), true);
  assertEquals(columnNames(db, "users").includes("gotify_token"), true);
  assertEquals(columnNames(db, "completion_logs").includes("due_at"), true);

  if (expectSentinel) {
    assertEquals(
      db.prepare("SELECT email FROM users WHERE id = ?").get("legacy-user"),
      { email: "legacy@example.com" },
    );
    assertEquals(
      db.prepare("SELECT status, revision FROM chores WHERE id = ?").get(
        "legacy-chore",
      ),
      { status: "open", revision: 0 },
    );
    assertEquals(
      db.prepare("SELECT COUNT(*) AS count FROM completion_logs WHERE id = ?")
        .get("legacy-log") as unknown as CountRow,
      { count: 1 },
    );
  }
  db.close();
}

async function startContainer(
  docker: string,
  image: string,
  name: string,
  databasePath: string,
  port: number,
  extraEnv: Record<string, string> = {},
) {
  const envArgs = Object.entries({
    DB_ENV: "production",
    ENABLE_AUTH: "false",
    ...extraEnv,
  }).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
  await runCommand(docker, [
    "run",
    "--detach",
    "--name",
    name,
    ...envArgs,
    "--publish",
    `${port}:8080`,
    "--volume",
    `${databasePath}:/app/chores.db`,
    image,
  ]);
}

async function cleanupContainer(docker: string, name: string) {
  await runCommand(docker, ["rm", "--force", name], { check: false });
}

async function readContainerLogs(docker: string, name: string) {
  const result = await runCommand(docker, ["logs", name], { check: false });
  return `${result.stdout}${result.stderr}`;
}

async function waitForDeliveryStatus(
  databasePath: string,
  deliveryId: string,
  expected: string,
  timeoutMs = 12_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const db = new DatabaseSync(databasePath);
    const row = db.prepare(
      "SELECT status FROM notification_deliveries WHERE id = ?",
    ).get(deliveryId) as { status: string } | undefined;
    db.close();
    if (row?.status === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${deliveryId} did not reach ${expected}`);
}

function countSchedulerStarts(logs: string): number {
  return logs.match(/scheduler_started/g)?.length ?? 0;
}

Deno.test({
  name:
    "production scheduler starts once after migration and recovers pending row",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const docker = await findDockerCli();
    const id = crypto.randomUUID();
    const image = `chores-app-production-lifecycle:${id}`;
    const tempDir = await Deno.makeTempDir({ prefix: "chores-prod-life-" });
    const containers: string[] = [];

    try {
      await runCommand(docker, [
        "build",
        "--file",
        "Containerfile",
        "--tag",
        image,
        ".",
      ]);

      const freshDb = `${tempDir}/fresh.db`;
      await createWritableFile(freshDb);
      const freshContainer = `chores-prod-fresh-${id}`;
      containers.push(freshContainer);
      const freshPort = allocatePort();
      await startContainer(docker, image, freshContainer, freshDb, freshPort);
      await waitForHttp(freshPort);
      assertMigrated(freshDb, false);
      await cleanupContainer(docker, freshContainer);

      const legacyDb = `${tempDir}/legacy.db`;
      createLegacyDatabase(legacyDb);
      await Deno.chmod(legacyDb, 0o666);
      const legacyContainer = `chores-prod-legacy-${id}`;
      containers.push(legacyContainer);
      const legacyPort = allocatePort();
      await startContainer(
        docker,
        image,
        legacyContainer,
        legacyDb,
        legacyPort,
      );
      await waitForHttp(legacyPort);
      assertMigrated(legacyDb, true);
      const legacyLogs = await readContainerLogs(docker, legacyContainer);
      assertEquals(countSchedulerStarts(legacyLogs), 1);
      await cleanupContainer(docker, legacyContainer);

      const restartDb = new DatabaseSync(legacyDb);
      restartDb.exec(`
        INSERT INTO users (id, email, name) VALUES ('nag-user', 'nag@example.com', 'Nag User');
        INSERT INTO chores (
          id,
          user_id,
          assignee_id,
          title,
          due_date,
          remind_until_done,
          nag_eligible_since,
          status
        ) VALUES (
          'nag-chore',
          'nag-user',
          'nag-user',
          'Nag Chore',
          '2030-01-01T10:00:00.000Z',
          1,
          '2030-01-01T09:00:00.000Z',
          'open'
        );
        INSERT INTO notification_deliveries (
          id,
          chore_id,
          recipient_id,
          kind,
          slot_key,
          deliver_after
        ) VALUES (
          'pending-delivery',
          'nag-chore',
          'nag-user',
          'assigned_nag',
          '2030-01-01T10:00:00.000Z',
          '2000-01-01T00:00:00.000Z'
        );
      `);
      restartDb.close();
      const restartContainer = `chores-prod-restart-${id}`;
      containers.push(restartContainer);
      const restartPort = allocatePort();
      await startContainer(
        docker,
        image,
        restartContainer,
        legacyDb,
        restartPort,
      );
      await waitForHttp(restartPort);
      await waitForDeliveryStatus(
        legacyDb,
        "pending-delivery",
        "undeliverable",
      );
      const afterRestartDb = new DatabaseSync(legacyDb);
      assertEquals(
        afterRestartDb.prepare(`
          SELECT COUNT(*) AS count
          FROM notification_deliveries
          WHERE chore_id = 'nag-chore'
            AND recipient_id = 'nag-user'
            AND kind = 'assigned_nag'
            AND slot_key = '2030-01-01T10:00:00.000Z'
        `).get() as unknown as CountRow,
        { count: 1 },
      );
      afterRestartDb.close();
      await cleanupContainer(docker, restartContainer);

      const disabledDb = `${tempDir}/disabled.db`;
      createLegacyDatabase(disabledDb);
      await Deno.chmod(disabledDb, 0o666);
      const disabledContainer = `chores-prod-disabled-${id}`;
      containers.push(disabledContainer);
      const disabledPort = allocatePort();
      await startContainer(
        docker,
        image,
        disabledContainer,
        disabledDb,
        disabledPort,
        { ENABLE_NOTIFICATIONS: "false" },
      );
      await waitForHttp(disabledPort);
      const disabledLogs = await readContainerLogs(docker, disabledContainer);
      assertEquals(countSchedulerStarts(disabledLogs), 0);
      await cleanupContainer(docker, disabledContainer);

      const incompatibleDb = `${tempDir}/incompatible.db`;
      createIncompatibleDatabase(incompatibleDb);
      await Deno.chmod(incompatibleDb, 0o666);
      const incompatibleContainer = `chores-prod-incompatible-${id}`;
      containers.push(incompatibleContainer);
      const incompatiblePort = allocatePort();
      await startContainer(
        docker,
        image,
        incompatibleContainer,
        incompatibleDb,
        incompatiblePort,
      );
      await assertNoHttp(incompatiblePort, 4_000);
      const logs = await readContainerLogs(docker, incompatibleContainer);
      if (!logs.includes("Migration 1 (0001_baseline) failed")) {
        throw new Error(`container did not report migration failure\n${logs}`);
      }
    } finally {
      for (const container of containers) {
        await cleanupContainer(docker, container);
      }
      await runCommand(docker, ["rmi", image], { check: false });
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});

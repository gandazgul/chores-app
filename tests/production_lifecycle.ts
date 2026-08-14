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

function assertMigrated(path: string, expectSentinel: boolean) {
  const db = new DatabaseSync(path);
  const ledger = db.prepare("SELECT version, name FROM schema_migrations")
    .all() as unknown as LedgerRow[];
  assertEquals(ledger, [{ version: 1, name: "0001_baseline" }]);
  baselineMigration.validate(db);

  if (expectSentinel) {
    assertEquals(
      db.prepare("SELECT email FROM users WHERE id = ?").get("legacy-user"),
      { email: "legacy@example.com" },
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
) {
  await runCommand(docker, [
    "run",
    "--detach",
    "--name",
    name,
    "--env",
    "DB_ENV=production",
    "--env",
    "ENABLE_AUTH=false",
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

Deno.test({
  name: "production container runs migrations before readiness",
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
      await cleanupContainer(docker, legacyContainer);

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

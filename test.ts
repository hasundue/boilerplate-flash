import { readLines } from "https://deno.land/std@0.144.0/io/mod.ts";
import {
  assertEquals,
  assertObjectMatch,
} from "https://deno.land/std@0.144.0/testing/asserts.ts";

async function startServer(file: string, ...options: string[]) {
  const proc = Deno.run({
    cmd: ["denoflare", "serve", file].concat(options),
    stdout: "piped",
    stderr: "inherit",
  });

  for await (const line of readLines(proc.stdout)) {
    if (line.match("Local server running")) break;
  }

  // proc.stdout.readable.pipeTo(Deno.stdout.writable);

  return proc;
}

const host = "http://localhost:8080";

Deno.test("test", async (t) => {
  const test = async (
    request: {
      path: string;
      method: string;
      body?: Record<string, unknown>;
    },
    expect: {
      status: number;
      value?: Record<string, unknown> | string;
    },
  ) => {
    const { path, method, body } = request;
    const { status, value } = expect;

    const str = body ? JSON.stringify(body) : "";

    await t.step(
      `${method}\t${path}\t${str}`,
      async () => {
        const response = await fetch(host + path, {
          method: method,
          body: JSON.stringify(body),
          headers: body ? { "Content-type": "application/json" } : undefined,
        });

        const json = await response.json();

        const log = response.status === 500 ? json.stack : json;
        console.log(log);

        assertEquals(response.status, status);

        if (value) {
          if (typeof value === "string") assertEquals(json, value);
          else assertObjectMatch(json, value);
        }
      },
    );
  };

  const proc = await startServer("./worker.ts");

  try {
    await test({ path: "/", method: "GET" }, {
      status: 200,
      value: "Hello, World!",
    });
  } finally {
    proc.stdout.close();
    proc.close();
  }
});

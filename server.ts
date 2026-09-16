import { watch } from "node:fs";
import { judge, parseLines, readMeta, type Event, type JudgeResult, type Trail } from "./judge";

const args = Bun.argv.slice(2);
const flag = (k: string, d?: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const replayFile = flag("replay");
const watchFile = flag("watch");
let speed = Number(flag("speed", "20"));
const N = Number(flag("n", "6"));
let minGap = Number(flag("min-gap", "250"));
const gate = !args.includes("--no-gate");
const port = Number(flag("port", "8787"));
const mock = args.includes("--mock") || !!process.env.MOCK_JUDGE;
const model = flag("model");
const file = replayFile ?? watchFile;
if (!file) {
  console.error("usage: bun server.ts --replay doomed.jsonl [--speed 20] [--min-gap 250] [--n 6] [--no-gate] | --watch <session.jsonl>  [--mock] [--model id] [--port 8787]");
  process.exit(1);
}
const PLUG = new URL("./.plug-pulled", import.meta.url).pathname;

let renderGate: ((t: Trail, o: { file: string; model: string }) => string) | null = null;
try {
  renderGate = (await import("./gate")).renderGateMarkdown;
} catch {}

// ---- state ----
let events: Event[] = [];
let meta = readMeta(await Bun.file(file).text());
let judgeState: { state: string; detail?: string } = { state: "idle" };
let lastTrail: any = null;
let judgedUpto = 0;
let judging: Promise<void> | null = null;
let generation = 0;
const clients = new Set<ReadableStreamDefaultController>();
const enc = new TextEncoder();

function send(c: ReadableStreamDefaultController, name: string, data: any) {
  try {
    c.enqueue(enc.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
  } catch {
    clients.delete(c);
  }
}
const broadcast = (name: string, data: any) => clients.forEach((c) => send(c, name, data));
const forUi = (e: Event) => ({ ...e, text: e.text.slice(0, 300) });
const resetMsg = () => ({ file: file.split("/").pop(), mode: replayFile ? "replay" : "live", speed: replayFile ? speed : 1, minGap, meta });

function pushEvent(e: Event) {
  events.push(e);
  broadcast("event", forUi(e));
}

async function runJudge(final = false) {
  if (judging) return judging;
  if (!final && events.length - judgedUpto < N) return;
  if (events.length === 0 || (final && events.length === judgedUpto)) return;
  const upto = events.length;
  judging = (async () => {
    judgeState = { state: "thinking" };
    broadcast("judge", judgeState);
    try {
      const r: JudgeResult = await judge(events.slice(0, upto), { mock, model });
      judgedUpto = upto;
      if (!r.trail) {
        judgeState = { state: "declined", detail: r.stop_details?.category ?? r.stop_reason ?? "refusal" };
      } else {
        lastTrail = { trail: r.trail, usage: r.usage, ms: r.ms, model: r.model, upto, gateMarkdown: renderGate ? renderGate(r.trail, { file: file.split("/").pop()!, model: r.model }) : undefined };
        broadcast("trail", lastTrail);
        judgeState = { state: r.model === "mock" ? "mock" : "idle" };
      }
      console.log(`[judge] upto=${upto} ${r.model} ${r.ms}ms cache_read=${r.usage.cache_read} cache_create=${r.usage.cache_create} in=${r.usage.input} → ${r.trail?.status ?? "declined"} fatal_turn=${r.trail?.fatal_turn}`);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      judgeState = msg === "nokey" ? { state: "nokey" } : { state: "error", detail: msg.slice(0, 200) };
      console.error("[judge]", msg);
    }
    broadcast("judge", judgeState);
  })().finally(() => (judging = null));
  return judging;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function replay() {
  const gen = ++generation;
  events = [];
  judgedUpto = 0;
  lastTrail = null;
  judgeState = { state: "idle" };
  broadcast("reset", resetMsg());
  const all = parseLines((await Bun.file(file).text()).split("\n"));
  let prev: number | null = null;
  for (const e of all) {
    if (gen !== generation) return;
    const t = Date.parse(e.ts);
    const gap = prev != null && !isNaN(t) ? Math.min(3000, Math.max(minGap, (t - prev) / speed)) : minGap;
    if (!isNaN(t)) prev = t;
    await sleep(gap);
    if (gen !== generation) return;
    pushEvent(e);
    runJudge();
    if (gate && judging) await judging;
  }
  await runJudge(true);
  if (gen === generation) broadcast("done", {});
}

async function live() {
  let offset = 0;
  let buf = "";
  const tick = async () => {
    const f = Bun.file(file);
    const size = f.size;
    if (size < offset) {
      offset = 0;
      buf = "";
      events = [];
      judgedUpto = 0;
      broadcast("reset", resetMsg());
    }
    if (size === offset) return;
    buf += await f.slice(offset, size).text();
    offset = size;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const e of parseLines(lines, events.length)) pushEvent(e);
    runJudge();
  };
  broadcast("reset", resetMsg());
  await tick();
  try {
    watch(file, () => tick());
  } catch {}
  setInterval(tick, 700);
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response(Bun.file(new URL("./index.html", import.meta.url).pathname));
    if (url.pathname === "/events") {
      let ctrl!: ReadableStreamDefaultController;
      const stream = new ReadableStream({
        start(c) {
          ctrl = c;
          clients.add(c);
          send(c, "reset", resetMsg());
          for (const e of events) send(c, "event", forUi(e));
          if (lastTrail) send(c, "trail", lastTrail);
          send(c, "judge", judgeState);
          send(c, "plug", { pulled: !!(await0(PLUG)) });
        },
        cancel() {
          clients.delete(ctrl);
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
    }
    if (req.method === "POST" && url.pathname === "/plug") {
      const t = lastTrail?.trail;
      const why = t ? `${t.sentence} (status ${t.status}${t.fatal_turn != null ? `, fatal at #${t.fatal_turn}` : ""})` : "Plug pulled manually.";
      await Bun.write(PLUG, `${why}\n${new Date().toISOString()}\n`);
      broadcast("plug", { pulled: true });
      return new Response("ok");
    }
    if (req.method === "POST" && url.pathname === "/unplug") {
      try {
        await Bun.file(PLUG).unlink();
      } catch {}
      broadcast("plug", { pulled: false });
      return new Response("ok");
    }
    if (req.method === "POST" && url.pathname === "/restart") {
      if (replayFile) replay();
      return new Response("ok");
    }
    if (req.method === "POST" && url.pathname === "/speed") {
      if (url.searchParams.has("speed")) speed = Math.max(1, Number(url.searchParams.get("speed")));
      if (url.searchParams.has("minGap")) minGap = Math.max(0, Number(url.searchParams.get("minGap")));
      broadcast("speed", { speed, minGap });
      return new Response("ok");
    }
    const m = url.pathname.match(/^\/event\/(\d+)$/);
    if (m) {
      const i = Number(m[1]);
      return Response.json({ i, events: events.slice(Math.max(0, i - 2), i + 3) });
    }
    if (url.pathname === "/gate.md") return new Response(lastTrail?.gateMarkdown ?? "not available yet", { headers: { "Content-Type": "text/markdown" } });
    return new Response("not found", { status: 404 });
  },
});

function await0(p: string) {
  try {
    return require("node:fs").existsSync(p);
  } catch {
    return false;
  }
}

console.log(`tamabotchi on http://localhost:${port}  ${replayFile ? `replay ${file} @${speed}x` : `live ${file}`}  n=${N} gate=${gate} ${mock ? "MOCK" : model ?? "claude-fable-5-1"}`);
if (replayFile) replay();
else live();

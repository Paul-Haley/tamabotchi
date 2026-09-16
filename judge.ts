import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type Event = {
  i: number;
  ts: string;
  kind: "user" | "assistant" | "tool_use" | "tool_result";
  label: string;
  text: string;
  isError: boolean;
  agent?: string;
};

export const TrailSchema = z.object({
  goal: z.string(),
  status: z.enum(["ok", "drifting", "fatal"]),
  sentence: z.string(),
  decisions: z.array(
    z.object({
      turn: z.number().int(),
      label: z.string(),
      direction: z.enum(["toward", "sideways", "away"]),
      why: z.string(),
      evidence: z.string(),
      contradicts: z.number().int().nullable(),
      agent: z.string().nullable(),
    }),
  ),
  fatal_turn: z.number().int().nullable(),
});
export type Trail = z.infer<typeof TrailSchema>;

export type JudgeResult = {
  trail: Trail | null;
  usage: { input: number; cache_read: number; cache_create: number; output: number };
  ms: number;
  model: string;
  stop_reason: string | null;
  stop_details?: any;
};

export type Meta = { recorded?: string; edited?: boolean } | null;

const MODEL = "claude-fable-5-1";
const CAP_INPUT = 1500;
const CAP_HEAD = 1000;
const CAP_TAIL = 500;
const rubric = await Bun.file(new URL("./rubric.txt", import.meta.url)).text();

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + `…[+${s.length - n} chars]` : s);
const headTail = (s: string) =>
  s.length > CAP_HEAD + CAP_TAIL ? s.slice(0, CAP_HEAD) + `\n…[${s.length - CAP_HEAD - CAP_TAIL} chars omitted]…\n` + s.slice(-CAP_TAIL) : s;

function blockText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => (b?.type === "text" ? b.text : b?.type === "image" ? "[image]" : "")).filter(Boolean).join("\n");
  return "";
}

const stripHarness = (s: string) =>
  s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .trim();

type Raw = Omit<Event, "i">;

function eventsFromMessage(role: string, content: any, ts: string, agent?: string): Raw[] {
  const out: Raw[] = [];
  if (typeof content === "string") {
    const text = stripHarness(content);
    if (text) out.push({ ts, kind: "user", label: "", text: clip(text, 4000), isError: false, agent });
    return out;
  }
  if (!Array.isArray(content)) return out;
  for (const b of content) {
    switch (b?.type) {
      case "text": {
        const text = stripHarness(b.text ?? "");
        if (text) out.push({ ts, kind: role === "assistant" ? "assistant" : "user", label: "", text: clip(text, 4000), isError: false, agent });
        break;
      }
      case "tool_use":
        out.push({ ts, kind: "tool_use", label: b.name ?? "?", text: clip(JSON.stringify(b.input ?? {}), CAP_INPUT), isError: false, agent });
        break;
      case "tool_result": {
        const isError = !!b.is_error;
        out.push({ ts, kind: "tool_result", label: isError ? "ERROR" : "ok", text: headTail(blockText(b.content)), isError, agent });
        break;
      }
    }
  }
  return out;
}

export function parseLine(line: string): Raw[] {
  let d: any;
  try {
    d = JSON.parse(line);
  } catch {
    return [];
  }
  if (d?.type === "progress" && d.data?.message?.message?.role) {
    const m = d.data.message;
    return eventsFromMessage(m.message.role, m.message.content, m.timestamp ?? d.timestamp ?? "", String(d.toolUseID ?? d.data.agentId ?? "sub").slice(-6));
  }
  if ((d?.type !== "user" && d?.type !== "assistant") || d.isMeta || !d.message) return [];
  return eventsFromMessage(d.message.role, d.message.content, d.timestamp ?? "", d.isSidechain ? "side" : undefined);
}

export function parseLines(lines: string[], start = 0): Event[] {
  const out: Event[] = [];
  for (const line of lines) for (const r of parseLine(line)) out.push({ i: start + out.length, ...r });
  return out;
}

export const parseEvents = (text: string) => parseLines(text.split("\n"));

export function readMeta(text: string): Meta {
  try {
    const d = JSON.parse(text.slice(0, text.indexOf("\n")));
    return d?.type === "tamabotchi-meta" ? { recorded: d.recorded, edited: !!d.edited } : null;
  } catch {
    return null;
  }
}

export const renderEvent = (e: Event) => `#${e.i} [${e.kind}${e.label ? " " + e.label : ""}${e.agent ? " subagent:" + e.agent : ""}] ${e.text}`;

export function mockTrail(events: Event[]): Trail {
  const n = events.length;
  const picks = events.filter((e) => e.kind === "tool_use");
  const step = Math.max(1, Math.ceil(picks.length / 8));
  const decisions = picks.filter((_, k) => k % step === 0).slice(0, 12).map((e, k, arr) => ({
    turn: e.i,
    label: `Ran ${e.label}`,
    direction: (k === arr.length - 1 && n > 40 ? "away" : k > arr.length * 0.6 && n > 20 ? "sideways" : "toward") as "toward" | "sideways" | "away",
    why: "mock verdict, no API key",
    evidence: e.text.slice(0, 80),
    contradicts: k === arr.length - 1 && n > 40 ? 0 : null,
    agent: e.agent ?? null,
  }));
  const status = n > 40 ? "fatal" : n > 20 ? "drifting" : "ok";
  return { goal: "(mock) do what the user asked", status, sentence: `Mock judge: ${n} events seen, pretending things are ${status}.`, decisions, fatal_turn: status === "fatal" ? decisions.at(-1)?.turn ?? null : null };
}

export async function judge(events: Event[], opts: { model?: string; mock?: boolean; effort?: "low" | "medium" | "high" } = {}): Promise<JudgeResult> {
  const t0 = Date.now();
  if (opts.mock) return { trail: mockTrail(events), usage: { input: 0, cache_read: 0, cache_create: 0, output: 0 }, ms: Date.now() - t0, model: "mock", stop_reason: "end_turn" };
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("nokey");

  const blocks: Anthropic.TextBlockParam[] = events.map((e) => ({ type: "text", text: renderEvent(e) }));
  if (blocks.length) blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  blocks.push({ type: "text", text: `Judge events #0..#${Math.max(0, events.length - 1)} now.` });

  const client = new Anthropic();
  const res = await client.messages.parse({
    model: opts.model ?? MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: rubric, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: [{ role: "user", content: blocks }],
    output_config: { effort: opts.effort ?? "medium", format: zodOutputFormat(TrailSchema) },
  });
  const u: any = res.usage;
  return {
    trail: res.stop_reason === "refusal" ? null : (res.parsed_output ?? null),
    usage: { input: u.input_tokens ?? 0, cache_read: u.cache_read_input_tokens ?? 0, cache_create: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0 },
    ms: Date.now() - t0,
    model: res.model,
    stop_reason: res.stop_reason,
    stop_details: (res as any).stop_details ?? undefined,
  };
}

export async function judgeFile(path: string, opts: { upto?: number; mock?: boolean; model?: string } = {}): Promise<JudgeResult> {
  let events = parseEvents(await Bun.file(path).text());
  if (opts.upto != null) events = events.slice(0, opts.upto);
  return judge(events, opts);
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: bun judge.ts <session.jsonl> [--upto N] [--mock] [--model id] [--events]");
    process.exit(1);
  }
  const flag = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  if (args.includes("--events")) {
    for (const e of parseEvents(await Bun.file(file).text())) console.log(renderEvent(e).slice(0, 200));
    process.exit(0);
  }
  const r = await judgeFile(file, { upto: flag("upto") ? Number(flag("upto")) : undefined, mock: args.includes("--mock") || !!process.env.MOCK_JUDGE, model: flag("model") });
  console.log(JSON.stringify(r, null, 2));
}

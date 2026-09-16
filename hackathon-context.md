# Hackathon Context

Single source of truth for judging/winning criteria. Read this before proposing what to build.

## Event
- Claude Community hackathon, 2026-09-16 18:00–21:00 AEST (3 hrs), solo or teams of 2-4.
- Venue: UpperGround by Hudson.

## Prompt: "Pick a track"
Build something of your own choosing that pushes **Fable 5.1**. Tracks describe the *quality* of what you build, not the domain — pick one to aim at:

- **Delight** — surprising, beautiful, or fun.
- **Breakthrough** — something you could not build before (i.e. only possible because of Fable 5.1's new capability).
- **Everyday** — solves a real problem in your life.

Per project CLAUDE.md goal: demonstrate a capability of Fable 5.1 through something only it could do, or something only Fable can do operationally — this points hardest at the **Breakthrough** track, though a strong **Delight** entry counts too. Whatever track we pick, the model must be the visible differentiator, not just an app with an LLM bolted on.

## Judges
- **Robert Li** — Director of AI & GTM Engineering (Brisbane GTM consultancy). Writes on GTM engineering / AI search behaviour (e.g. AI citation click-through ~1% vs 15% for traditional search); pitched an AI Safety project at a design-thinking hackathon he ran. Responds to: a crisp problem statement, visible sourcing/provenance, a safety-aware detail.
- **Sam Marshall** — Principal Forward Deployed Engineer, V2 AI (Anthropic Select partner; Claude-Code-centric agentic delivery). Judges FDE-style: is it grounded, observable, honest when it fails, could it actually ship.
- **Lucas Ridley** — tech recruiter, UpperGround by Hudson (venue host). Non-technical. Scores on whether he gets it in ten seconds.
- One judge TBC.
- Wayne (Pluralsight Principal Author, cloud/K8s) is assisting builds, not judging.

## Implications for the demo
- Need a **10-second read** for Lucas: obvious what it does and why it's cool, no setup narration required.
- Need **visible groundedness** for Sam: show sourcing, real output, and honest failure states (not a happy-path-only mock) — matches "kinda work, don't be rigorous, but not too sloppy" from CLAUDE.md.
- A **provenance/safety detail** would land well with Robert if relevant (e.g. show where an answer/action came from, flag uncertainty).
- Core bet: the thing should fail or look ordinary if you swap out Fable 5.1 for a lesser model — that's the "only Fable" story for Breakthrough.

## Constraints (from CLAUDE.md)
- 3-hour build window, code should work but doesn't need rigor; must survive the last 20 minutes without collapsing.
- Minimal comments/docs — intent should be obvious from the implementation.

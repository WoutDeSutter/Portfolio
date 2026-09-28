# Wout De Sutter — XR Portfolio

## Brief

`docs/BRIEF.md` contains the complete design/product brief. Read it before design, UX, content-model, or feature decisions. This file contains only permanent working rules; do not duplicate the full brief here, and keep working rules (stack, commands, Git, deployment) here rather than in the brief.

`docs/CONTENT.md` explains how to add projects, text, media, demos and music; keep it in sync when the content model changes.

The previous concept ("The Stage", a black-box studio with a text column) is preserved on the branch `archive/stage-v1` as a fallback. Do not build on it; reuse its tested parts where they still fit.

## Goal

Build an **immersive XR-inspired portfolio** for **Wout De Sutter, XR Student MCT**. It must help with internships/jobs and showcase real XR work, experiments, CV, and contact information.

Target audience: XR companies, theme parks, event companies, technology companies, and internship supervisors.

The site should feel **creative, futuristic, experimental, XR-focused, and professional**. It must not look childish, gimmicky, generic, or obviously AI-generated.

## Concept: the festival

The whole site is **one fully 3D, interactive festival terrain at night**. Wout works in the stage/event industry; the festival is his world. Details and layout are in `docs/BRIEF.md`.

| Place | Content |
|---|---|
| Entrance | arrival; overview of the terrain (camera starts here) |
| Main stage (back, centre) | About me — name and role on the LED wall |
| FOH tent (centre) | easter egg: choose/start/stop music on the speakers, control the stage lights |
| Booths left | Projects (food truck, projects as the menu), Lab |
| Booths right | Contact (info point), Links, Merch (CV download) |

- Visitors **look around** (camera follows the cursor, drag to orbit within limits) and **click** a booth or the stage: the camera travels there and its content opens as a panel. Back = button, Esc or clicking beside it.
- The URL stays the source of truth: every place and project has its own route (e.g. `/#/projects/tagrun` opens the Projects booth with that project).
- It is a portfolio first: every place must be reachable and understandable within seconds; the festival is the way in, not an obstacle.

## UI rules

- **No visible interface chrome**: no header, logo bar, menus or minimap. Identity (name, role) lives *in the world* (LED wall, entrance arch).
- The **only** permanent visible control is the **EN/NL language toggle**. While music plays, a **mute button** appears next to it (and disappears when the music stops).
- Signs on booths are translated labels (from the i18n files), not hardcoded text.
- Accessibility without chrome: keyboard and screen-reader users get hotspot buttons for every place, **visible only when focused**. Content panels are real HTML (headings, links, focus management). Without WebGL, or when the world fails to start, the site falls back to a simple text version — the only place where conventional navigation is visible. Test it during development by adding `?text` before the hash (`localhost:5173/?text#/about`).

## Audio

- Music is an easter egg in the FOH: it is chosen, started and stopped there. **Never autoplay.**
- The speakers are positional audio sources in the scene (Three.js `PositionalAudio` + `AudioListener` on the camera), so moving towards a booth on the right makes the stage sound come from the left.
- Tracks are supplied by Wout (NCS). Always show title + artist credit in the FOH while a track plays. Track list and credits are data, not code.
- The mute button is required for accessibility whenever audio plays.

## 3D assets

- Style: **low-poly, but not too low-poly**, lit (not wireframe), night setting with red stage lighting as the accent.
- Models are made in Blender (Wout, or Claude via the Blender connection) and kept as `.blend` sources so Wout can edit them; the site loads exported `.glb` files from `public/models/`. Start with greybox geometry in code to validate the interaction before modelling.
- Keep models small (compressed, merged where static) and load them lazily.

## Agreed stack

- React
- TypeScript
- Vite
- Three.js for 3D/WebGL (addons such as `OrbitControls`, `GLTFLoader` come with Three.js — not new dependencies)
- GSAP when advanced animation is actually useful
- React Router with `HashRouter` for GitHub Pages
- Plain CSS + CSS variables
- JSON-driven portfolio content
- GitHub Pages

Do not add dependencies just because they are popular. Ask before adding a new dependency unless it is clearly required by the current agreed stack/task.

## Architecture

The UX is **one connected immersive world**, while the code remains modular: data, HTML panels and 3D logic stay separated.

Individual projects must have direct shareable routes, e.g.:

`/#/projects/tagrun`

Do not force recruiters to explore to reach a project they were sent a link to.

Keep content out of React components:

```text
src/data/projects.json   # language-neutral project data (slug, kind, status, tech, media, links)
src/data/skills.json     # skill ids referenced by projects.json `technologies`
src/data/site.json       # name, contact channels, CV path, Formspree id
src/data/i18n/nl.json    # all Dutch text: UI strings + translatable project content
src/data/i18n/en.json    # all English text: same keys as nl.json
```

- `projects.json` contains every project, including LAB entries. The `kind` field decides the presentation: `"featured"`, `"project"`, or `"lab"`.
- Translatable text (titles, descriptions, case-study content, UI labels, booth signs) lives only in `nl.json` / `en.json`. Never hardcode user-facing text in components or the scene.
- `nl.json` and `en.json` must always have the same keys (a dev-mode check warns in the console).
- Case-study sections are optional: a section is shown only when `projects.<slug>.sections.<id>` exists (ids in `PROJECT_SECTIONS`, `src/content/types.ts`).
- Language: stored choice → browser language → English fallback.

Code map:

- `src/festival/places.ts` — every place on the terrain (id, route, position, facing, view distance); plain data shared by React and the world. `getPlaceForPath()` maps a URL to a place.
- `src/festival/Festival.tsx` — the site layout: `WorldLayer` (3D), `Hotspots` (keyboard links), the EN/NL toggle, and the open panel via `<Outlet />`; text version without WebGL.
- `src/world/` — plain Three.js, lazily loaded: `world.ts` (`createFestivalWorld()` → `{ goTo, setFrame, setLabels, ready, dispose }`), `rig.ts` (camera: place view + drag/zoom + cursor look, steps back / widens the view when the visible area is narrow), `greybox.ts` (block versions of booth, stage, FOH, entrance — to be replaced by Blender models), `sign.ts` (canvas-text signs).
- `src/panels/` — one panel per place + `ProjectPanel` (case study) and `Overview` (hint / text-version intro). `components/Panel.tsx` handles focus, Esc and reports its size to the world (`PanelFrameContext`).

Reused from v1 (tested): `src/content/`, `src/i18n/`, the case-study components (`ProjectSections`, `ProjectFacts`, `ProjectMedia`, `ProjectDemo`), `ContactForm`, `ExternalLink`, `utils/whenIdle.ts`, fonts, tokens, the deploy workflow.

3D principles (learned in v1, keep them):

- The scene is plain Three.js behind a small API (`goTo`, `ready`, `dispose`), loaded lazily via dynamic import when the browser is idle. React only forwards route changes; the scene never owns content.
- Render **on demand**: only draw a frame when something changes (camera, animation, hover, resize, loaded asset); call `invalidate()` for changes that don't move the camera.
- Compile shaders ahead (`compileAsync`) and fade the world in when ready; show something meaningful while it loads.
- Dispose geometries, materials, textures and listeners when the scene is removed.

Fonts: IBM Plex Sans + IBM Plex Mono, weights 400/500, Latin1 subsets, self-hosted in `public/fonts` (declared in `src/styles/fonts.css`; Vite rewrites the URLs to relative paths).

Add other data files only when there is a real need.

Projects should support, as applicable:

- title / slug
- descriptions / case-study content
- status
- categories
- technologies
- kind (`featured` / `project` / `lab`)
- images / video
- 3D or WebGL/WebXR demo
- APK/downloads
- external links

Never invent Wout's experience, skills, responsibilities, results, metrics, clients, awards, or achievements. Ask when information is missing.

## Projects

Presentation levels (set via `kind` in `projects.json`):

1. **Featured projects** (`featured`) — large, visually rich case studies.
2. **Smaller projects** (`project`) — compact presentation.
3. **LAB** (`lab`) — compact experiments and prototypes (shown at the Lab booth).

Projects must support statuses such as `concept`, `in-progress`, `completed`, and `archived`.

Interactive demos are optional per project and must be easy to enable/disable.

Known projects include:

- TagRun
- Puzzle Roulette
- KitchenApp
- Post-It Machine
- XR Posture Checker

Do not assume details about these projects that have not been provided.

## Visual rules

- Dark night setting; red is the primary accent (stage light, hover, signs), not an overwhelming colour.
- Clean, modern, professional typography in the panels.
- Smooth, purposeful interaction.
- 3D supports navigation/storytelling; every object has a reason to be there.
- Avoid excessive gradients, glassmorphism, glowing text, particles, giant generic hero text, decorative code, fake statistics, and generic AI-portfolio patterns.
- No skill bars, percentages, fake proficiency scores, or arbitrary rankings.
- Every major visual effect must have a reason.
- Inspired by the *category* of https://pavlo-stijn.dev/ (explore a 3D world, click to zoom in) — never copy its look, assets or implementation.

## Performance / accessibility

- Desktop and mobile must work properly (touch: drag to look, tap to go; panels as bottom sheets).
- Load the basic page before heavy 3D/media; lazy-load models, textures, audio and video.
- Provide a usable fallback when WebGL is unavailable.
- Respect `prefers-reduced-motion` (camera cuts instead of flights, no idle motion).
- Essential content cannot depend on hover, audio, or WebGL.
- Use semantic HTML, accessible labels, and readable contrast.
- Do not autoplay website music.
- Conventions: panel headings receive focus when a panel opens and focus returns to the hotspot when it closes; decorative glyphs (→ ← ↗) are `aria-hidden`; links to other sites use `ExternalLink` (announces "opens in a new tab"); a control's accessible name starts with its visible text.

## Content

Current professional areas include:

`Unity, Blender, Python, Flask, FastAPI, C#, .NET, Arduino, XR, VR, AR, ESP32, Raspberry Pi, Projection Mapping`

Robotics is not a primary direction.

The site supports Dutch and English via `src/data/i18n/nl.json` and `en.json`. Final introduction/copy will be supplied later.

Required areas: immersive exploration (the terrain), featured work + projects (Projects booth), LAB (Lab booth), about (main stage), CV download (Merch), contact (info point), links.

Contact channels: email, LinkedIn, GitHub, Discord, contact form.

GitHub Pages has no backend: the contact form (`components/ContactForm.tsx`) posts to Formspree using `site.json → contactForm.formspreeId`. Without an id the form is not rendered (the channels remain); when sending fails it shows the email as a `mailto:` fallback.

## GitHub Pages

The GitHub repository is `https://github.com/WoutDeSutter/Portfolio`.

Vite uses `base: './'` (relative asset paths). With `HashRouter` the HTML file never moves, so the same build works on `woutdesutter.github.io/Portfolio/` and on the custom domain.

Commits in this repo use `desutterwout6@gmail.com` (set in the repo's local Git config). Do not change this without a reason.

Prefer `HashRouter` because GitHub Pages has no normal SPA history fallback. Do not introduce descriptive history-based routes without deliberately solving deployment fallback.

## Development workflow

Build in small, understandable steps. Wout is learning React, so briefly explain unfamiliar React/TypeScript concepts when they are introduced.

Prefer simple solutions over unnecessary abstractions. Do not rewrite working code without a reason.

Code, identifiers, comments, and technical documentation are in English.

Use small reusable components and keep data, UI, and 3D logic separated. Avoid giant components and hardcoded project content.

Validate new interaction with a quick greybox prototype before investing in models or polish.

Do not create Git commits unless Wout explicitly asks. When asked, use Conventional Commits, e.g.:

`feat: add immersive project navigation`

`fix: correct mobile project layout`

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

`package.json` is authoritative.

Deployment: `.github/workflows/deploy.yml` builds the site (`npm ci` + `npm run build`, Node 24) and publishes `dist/` to GitHub Pages on every push to `main` (or manually via Actions → Run workflow). A failing type-check stops the deploy. **Merging into `main` publishes the site.**

Domain: the portfolio lives at `portfolio.woutds.be` (DNS at Cloudflare: CNAME `portfolio` → `woutdesutter.github.io`, proxy off so GitHub can issue the HTTPS certificate). `woutds.be` and `www.woutds.be` only redirect there via a Cloudflare Redirect Rule (302, so the apex can be repurposed later without browsers caching the redirect). The custom domain is set in the repo's Pages settings — with a workflow deployment a `CNAME` file is ignored, so there is none.

## Definition of done

A feature is finished only when it:

- works on desktop and mobile
- builds without TypeScript/build errors
- matches `docs/BRIEF.md`
- keeps content data-driven
- does not add unnecessary complexity
- considers accessibility and reduced motion

When a requested feature conflicts with the brief, explain the conflict and choose the smallest solution that preserves the overall direction.

**Do not turn this into a generic template portfolio.**

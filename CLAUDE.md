# Wout De Sutter — XR Portfolio

## Brief

`docs/BRIEF.md` contains the complete design/product brief. Read it before design, UX, content-model, or feature decisions. This file contains only permanent working rules; do not duplicate the full brief here, and keep working rules (stack, commands, Git, deployment) here rather than in the brief.

## Goal

Build an **immersive XR-inspired portfolio** for **Wout De Sutter, XR Student MCT**. It must help with internships/jobs and showcase real XR work, experiments, CV, and contact information.

Target audience: XR companies, theme parks, event companies, technology companies, and internship supervisors.

The site should feel **creative, futuristic, experimental, XR-focused, and professional**. It must not look childish, gimmicky, generic, or obviously AI-generated.

## Agreed stack

- React
- TypeScript
- Vite
- Three.js for 3D/WebGL
- GSAP when advanced animation is actually useful
- React Router with `HashRouter` for GitHub Pages
- Plain CSS + CSS variables
- JSON-driven portfolio content
- GitHub Pages

Do not add dependencies just because they are popular. Ask before adding a new dependency unless it is clearly required by the current agreed stack/task.

## Architecture

The UX should feel like **one connected immersive world**, while the code remains modular.

Individual projects must have direct shareable routes, e.g.:

`/#/projects/tagrun`

Do not force recruiters to navigate the 3D environment to reach a project.

Keep content out of React components:

```text
src/data/projects.json   # language-neutral project data (slug, kind, status, tech, media, links)
src/data/skills.json     # skill ids referenced by projects.json `technologies`
src/data/site.json       # name, contact channels, CV path, Formspree id
src/data/i18n/nl.json    # all Dutch text: UI strings + translatable project content
src/data/i18n/en.json    # all English text: same keys as nl.json
```

- `projects.json` contains every project, including LAB entries. The `kind` field decides the presentation: `"featured"`, `"project"`, or `"lab"`.
- Translatable text (titles, descriptions, case-study content, UI labels) lives only in `nl.json` / `en.json`, keyed by project slug, e.g. `projects.tagrun.summary`. Never hardcode user-facing text in components.
- `nl.json` and `en.json` must always have the same keys (a dev-mode check warns in the console).
- Case-study sections are optional: a section is shown only when `projects.<slug>.sections.<id>` exists (ids in `PROJECT_SECTIONS`, `src/content/types.ts`).
- Language: stored choice → browser language → English fallback.

## Code map

- `src/content/` — types + typed access to the JSON data
- `src/i18n/` — `LanguageProvider`, `useTranslation()` (`t` / `tOptional`)
- `src/stations/` — one view per stage station + `stations.ts` (ids, routes, cue numbers, floor-plan positions)
- `src/components/` — shared UI (Shell, FloorPlan, ProjectRow, ...)
- `src/styles/tokens.css` — all theme values
- `src/scene/` — Three.js layer (planned): reads the current route, never owns content

Concept: "The Stage" — a black-box XR/stage studio. Red floor paths = navigation, featured projects = projection installations, camera travels between fixed stations. The DOM layer must always work on its own; 3D is an enhancement.

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
3. **LAB** (`lab`) — compact experiments and prototypes.

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

- Dark/near-black base.
- Red is the primary accent, not an overwhelming page color.
- Clean, modern, professional typography.
- Smooth, purposeful interaction.
- 3D should support navigation/storytelling, not exist only as decoration.
- Avoid excessive gradients, glassmorphism, glowing text, particles, giant generic hero text, decorative code, fake statistics, and generic AI-portfolio patterns.
- No skill bars, percentages, fake proficiency scores, or arbitrary rankings.
- Every major visual effect must have a reason.

## UX / 3D

The immersive concept may use a studio, XR lab, digital workshop, house/studio, gallery, or similar connected environment. The exact concept is defined/refined in `docs/BRIEF.md`.

Spatial navigation may use subtle floor arrows, paths, waypoints, environmental markers, or contextual labels. Keep it elegant; do not turn it into a literal game HUD.

Mobile may use a simplified version of the same world rather than copying desktop 3D exactly.

## Performance / accessibility

- Desktop and mobile must work properly.
- Load the basic interface before heavy 3D/media.
- Lazy-load large assets where appropriate.
- Provide a usable fallback when WebGL is unavailable.
- Respect `prefers-reduced-motion`.
- Essential content cannot depend on hover, audio, or WebGL.
- Use semantic HTML, accessible labels, and readable contrast.
- Do not autoplay website music.

## Content

Current professional areas include:

`Unity, Blender, Python, Flask, FastAPI, C#, .NET, Arduino, XR, VR, AR, ESP32, Raspberry Pi, Projection Mapping`

Robotics is not a primary direction.

The site supports Dutch and English via `src/data/i18n/nl.json` and `en.json`. Final introduction/copy will be supplied later.

Required eventual areas:

- immersive home/exploration
- featured work
- LAB
- about
- CV download
- contact

Contact channels: email, LinkedIn, GitHub, Discord, contact form.

GitHub Pages has no backend: the contact form must use a configurable third-party form service (e.g. Formspree) and fall back to a `mailto:` link when it is not configured or fails.

## GitHub Pages

The GitHub repository is named `portfolio` and will get a custom domain (add `public/CNAME` once the domain is known).

Vite uses `base: './'` (relative asset paths). With `HashRouter` the HTML file never moves, so the same build works on `<user>.github.io/portfolio/` and on the custom domain. Do not change this without a reason.

Prefer `HashRouter` because GitHub Pages has no normal SPA history fallback. Do not introduce descriptive history-based routes without deliberately solving deployment fallback.

## Development workflow

Build in small, understandable steps. Wout is learning React, so briefly explain unfamiliar React/TypeScript concepts when they are introduced.

Prefer simple solutions over unnecessary abstractions. Do not rewrite working code without a reason.

Code, identifiers, comments, and technical documentation are in English.

Use small reusable components and keep data, UI, and 3D logic separated. Avoid giant components and hardcoded project content.

Do not create Git commits unless Wout explicitly asks. When asked, use Conventional Commits, e.g.:

`feat: add immersive project navigation`

`fix: correct mobile project layout`

## Commands

Expected commands after initialization:

```bash
npm install
npm run dev
npm run build
npm run preview
```

`package.json` is authoritative once created.

Deployment: a GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the site and publishes `dist/` to GitHub Pages on every push to `main`. Set this up when the first deploy is needed.

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

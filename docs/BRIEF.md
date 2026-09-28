# Portfolio Design & Product Brief

## 1. Identity

**Name:** Wout De Sutter  
**Role:** XR Student MCT  
**Languages:** Dutch and English

The final introductory copy will be written later.

This is a personal portfolio for an XR student who wants to present technical ability, creative experimentation, projects, education, CV, and personality to potential internship and employment contacts.

---

## 2. Primary purpose

The portfolio has several connected goals:

- Find an internship in XR/AR/VR/interactive technology.
- Support future job applications.
- Demonstrate XR expertise.
- Demonstrate experimentation and technical curiosity.
- Provide access to Wout's CV.
- Present personal/contact information.
- Create a memorable personal web presence.

The site should be particularly relevant to:

- XR companies
- theme parks and immersive entertainment companies
- event companies
- technology companies
- internship supervisors
- creative technology organisations

---

## 3. Core professional direction

The portfolio should communicate a combination of **technology + creativity + interaction + physical/digital systems**.

Current technologies and areas that may be presented include:

- Unity
- Blender
- Python
- Flask
- FastAPI
- C#
- .NET
- Arduino
- XR
- VR
- AR
- ESP32
- Raspberry Pi
- Projection Mapping

Robotics should not be presented as a primary professional direction.

The skill list must evolve from real projects rather than becoming a decorative list of technologies.

Do not invent skill levels or proficiency percentages.

---

## 4. Current projects

Known portfolio projects:

- TagRun
- Puzzle Roulette
- KitchenApp
- Post-It Machine
- XR Posture Checker

These projects may eventually be divided into featured projects, normal projects, or LAB experiments depending on their maturity and presentation quality. This is set per project via the `kind` field (`featured`, `project`, `lab`) in `projects.json`.

Do not assume project details that have not been provided.

---

## 5. Portfolio experience concept

The portfolio should not behave like a conventional website made of a header, hero, three cards, and a long scrolling list.

The chosen direction is a **fully 3D, interactive festival terrain at night**. Wout works in the stage/event industry, so the festival is his own world: the site is the place, not a page with 3D added.

Layout (seen from the entrance):

- **Entrance** (front) — arrival point; the camera starts here with an overview of the whole terrain. Name and role on the entrance arch.
- **Main stage** (back, centre) — **About me**. Truss, LED wall with Wout's name and role, stage lighting in red.
- **Audience field** between entrance and stage.
- **FOH tent** (centre of the field) — the front-of-house mix position Wout often works from in real life. An **easter egg**: from the desk the visitor chooses, starts and stops music on the speakers and controls the stage lights.
- **Booths on the left**: **Projects** (a food truck; the projects are its menu), **Lab** (a drinks stand; experiments are what's "on tap").
- **Booths on the right**: **Contact** (the info point), **Links** (socials), **Merch** (CV download — take the "merch" home).

Booth signs carry the section name (Projects, Lab, Contact, Links, Merch) instead of food or drinks.

An earlier concept ("The Stage", a black-box studio) was built and archived on `archive/stage-v1`: it worked, but felt too much like a website with a 3D background. The festival must feel like exploring a place.

The environment should feel professional and intentional rather than like a video game for its own sake: short distances, clear signs, everything reachable within seconds.

The inspiration is the feeling of interactive portfolio sites such as `pavlo-stijn.dev`, not a direct visual or structural copy.

Reference:

https://pavlo-stijn.dev/

---

## 6. Spatial navigation

Every portfolio section is a place on the terrain. Navigation happens **in the world**:

- **Look around**: the camera follows the cursor; dragging orbits within limits so the visitor never gets lost; limited zoom.
- **Hover** a booth or the stage: its sign lights up and a short label appears.
- **Click**: the camera travels there, the booth opens (e.g. shutters roll up) and its content appears as an HTML panel next to it.
- **Back**: a back control in the panel, Esc, or clicking beside the booth returns to the overview.
- Inside a booth, items are clickable too (e.g. a project on the Projects menu opens its case study).

There is **no visible interface chrome** — no header, logo bar, menu or minimap. The only permanent control is the EN/NL toggle (plus a mute button while music plays). Signs, lights and the camera itself are the wayfinding.

Do not make the interface resemble a literal game HUD.

---

## 7. One world, direct project URLs

The user experience should feel like one connected world.

However, individual projects must have direct shareable routes so Wout can send a recruiter directly to a project.

Example:

`/#/projects/tagrun`

This means the visual experience and technical URL structure are intentionally separate.

A recruiter should not have to navigate through the 3D environment to reach a project that Wout specifically shared with them.

---

## 8. Homepage

There is no conventional homepage: the first view is the festival terrain from the entrance.

Within the first seconds the visitor must understand:

1. Wout De Sutter — XR Student MCT (on the entrance arch / LED wall)
2. that the booths and the stage can be explored (signs, hover, a subtle hint)

The exact copy will be written later. No walls of text in the world; text lives in the panels.

---

## 9. Visual identity

### Overall character

The desired visual character is:

- Creative
- Futuristic
- Experimental
- XR
- Professional

The website should look like something made by a creative technologist, not a generic student template.

### Color

The primary palette should be dark/near-black with red as the main accent.

Red should primarily function as an accent rather than covering the entire interface.

Potential roles:

- navigation indicators
- active states
- highlights
- interactive elements
- important typography
- environmental lights
- selected objects
- progress/wayfinding elements

The exact red should be selected during visual prototyping.

Avoid excessive gradients.

### Typography

No final font has been selected yet.

Typography should be:

- clean
- modern
- readable
- professional
- slightly futuristic without becoming stereotypical sci-fi

Avoid fonts that make the site look childish, arcade-like, or overly gaming-focused.

---

## 10. Interaction style

The desired interaction style combines:

- clean modern UI
- smooth animation
- interactive elements
- 3D/WebGL
- immersive XR-inspired presentation

Animations should have purpose.

Good examples:

- objects responding subtly to the cursor
- environmental movement
- camera transitions
- project previews reacting to interaction
- smooth section transitions
- spatial wayfinding
- contextual UI appearing near interactive objects

Avoid:

- constant bouncing
- excessive particle effects
- animation everywhere
- gimmicky cursor effects
- random distortion effects
- unnecessary parallax

---

## 11. 3D and WebGL

Three.js/WebGL is encouraged because the portfolio itself should feel XR-inspired.

The 3D layer must remain optional from a performance perspective.

The site must be able to:

- load the basic interface first
- progressively load heavier 3D assets
- reduce complexity on mobile/low-powered devices
- provide a usable fallback when WebGL is unavailable

3D should support navigation and storytelling rather than exist only as decoration.

---

## 12. Project hierarchy

Projects have two presentation levels.

### Featured projects

Important projects receive a large, visually rich presentation.

A featured case study may contain:

- title
- summary
- hero image/video
- problem or goal
- concept
- development process
- interaction
- technical implementation
- Wout's role
- result/status
- gallery
- technology list
- links/downloads
- optional interactive demo

### Smaller projects

Smaller projects should be compact and quick to explore.

They should not require a huge case study page when there is not enough meaningful information.

---

## 13. LAB

The portfolio should have a **LAB** concept for experiments and smaller technical explorations.

LAB content may include:

- prototypes
- shader experiments
- XR experiments
- interaction tests
- WebXR experiments
- mapping experiments
- hardware/software experiments
- unfinished concepts
- proof-of-concepts

LAB entries can be much smaller than full project case studies.

LAB entries are stored in `projects.json` like any other project, with `"kind": "lab"`.

The LAB should communicate curiosity and experimentation without pretending every experiment is a finished product.

---

## 14. Project status

Projects should support a visible status.

Suggested statuses:

- Concept
- In Progress
- Completed
- Archived

The status must be data-driven from the project JSON.

---

## 15. Project media

The portfolio should support, where useful:

- images
- galleries
- videos
- 3D models
- WebGL demos
- WebXR demos
- downloadable APKs
- external project pages
- GitHub repositories
- other relevant files

Media should be optional.

A project should not show empty placeholders for media it does not have.

---

## 16. Interactive demos

Interactive project demos are desirable.

For example, a project may optionally expose:

- WebGL demo
- WebXR demo
- embedded interactive prototype
- external demo

Every project must be able to explicitly enable or disable its interactive demo.

The portfolio must not require every project to have an interactive demo.

---

## 17. Content model

Portfolio content should be stored in JSON so Wout can add projects without rewriting React components.

Project data and translatable text are stored separately.

`src/data/projects.json` contains only language-neutral data, for all projects including LAB entries:

```json
{
  "slug": "tagrun",
  "kind": "featured",
  "status": "completed",
  "categories": ["XR", "Unity", "Interactive"],
  "technologies": ["Unity", "C#"],
  "media": [],
  "demo": { "enabled": false },
  "links": []
}
```

`kind` is `featured`, `project`, or `lab`.

All text lives in `src/data/i18n/nl.json` and `src/data/i18n/en.json`, keyed by slug, next to the UI strings:

```json
{
  "nav": { "work": "Work", "lab": "Lab", "about": "About", "contact": "Contact" },
  "cv": { "download": "Download CV" },
  "projects": {
    "tagrun": {
      "title": "TagRun",
      "summary": "...",
      "role": "..."
    }
  }
}
```

Both language files must always contain the same keys.

The exact schema can evolve.

The JSON should remain human-readable and easy for Wout to edit.

---

## 18. Filtering and discovery

Filters are allowed, but should not dominate the design.

Potential categories include:

- XR
- VR
- AR
- Unity
- Unreal Engine if relevant in future
- Web
- Interactive
- Projection Mapping
- Hardware
- Experimental

Filtering can be integrated into the immersive environment instead of appearing as a conventional filter bar.

For example, interacting with a location/object may reveal projects belonging to a category.

If a traditional filter UI is used, it should remain visually minimal.

---

## 19. Skills

Skills should be presented in a way that connects them to actual work.

Avoid:

- progress bars
- percentages
- arbitrary skill scores
- fake expertise rankings

Possible interactions:

- selecting a technology reveals related projects
- technology labels appear within project presentations
- skills are shown in context rather than as a decorative wall of logos

---

## 20. About

An About section should eventually include relevant personal/professional information such as:

- Wout's education
- MCT background
- interests
- approach to XR
- selected technologies
- personal perspective
- optional photograph

A personal photo is not required for the first version and may be added later.

Do not invent personal information.

---

## 21. CV

The portfolio must provide a clear way to download Wout's CV.

The CV should be accessible from the main experience without requiring complicated navigation.

Potentially provide:

- Download CV
- View CV

The actual CV file will be supplied later.

---

## 22. Contact

Contact options should include:

- email
- LinkedIn
- GitHub
- Discord
- contact form

The exact addresses/usernames will be added later.

Because GitHub Pages has no backend, the contact form uses a configurable third-party form service (e.g. Formspree) and falls back to a `mailto:` link.

The contact area should feel integrated into the environment rather than being an ordinary footer-only contact section.

---

## 23. Social links

Potential social/professional links:

- GitHub
- LinkedIn
- Discord

Additional platforms may be added later if useful.

---

## 24. Mobile

Mobile support must be excellent.

The desktop immersive experience does not have to be copied literally onto mobile.

Mobile uses the **same festival** with touch controls:

- drag to look around, tap a booth to go there
- panels open as bottom sheets
- lower detail (pixel ratio, fewer lights/effects) to keep it smooth
- a text-only fallback when WebGL is unavailable

The content hierarchy must remain consistent.

---

## 25. Performance

Performance matters because the portfolio may contain 3D models, video, WebGL, and large images.

Use progressive loading.

Prioritize:

1. basic interface
2. readable content
3. navigation
4. essential assets
5. heavy 3D/media

Do not block the whole page while waiting for an optional asset.

Use compressed/optimized assets where practical.

Lazy-load large media when appropriate.

---

## 26. GitHub Pages

The target host is GitHub Pages. Technical configuration (Vite `base`, routing, deployment) is defined in `CLAUDE.md`.

Example routes:

```text
/#/
/#/projects/tagrun
/#/projects/puzzle-roulette
/#/projects/xr-posture-checker
```

---

## 27. Development stack

The planned stack is:

- React
- TypeScript
- Vite
- Three.js
- GSAP where useful
- React Router
- plain CSS
- CSS variables
- JSON data

Do not add libraries merely because they are popular.

Every dependency should solve a real problem.

---

## 28. Learning objective

Wout is learning React.

The development process should therefore teach as well as build.

When introducing something unfamiliar, explain briefly:

- what it is
- why it is being used
- where it fits into the project

Do not turn every implementation into a long tutorial. Keep explanations practical.

Build the project in understandable increments.

---

## 29. CSS direction

Use normal CSS and CSS variables.

The theme should be centrally controllable.

Example concept:

```css
:root {
  --color-background: #080808;
  --color-surface: #111111;
  --color-text: #f5f5f5;
  --color-muted: #999999;
  --color-accent: #e10600;
}
```

Exact values are subject to visual design testing.

Do not scatter hard-coded colors throughout components.

---

## 30. Typography direction

The font has not yet been chosen.

The eventual font should be:

- highly readable
- contemporary
- clean
- professional
- suitable for a technical/creative portfolio

The font should not make the site look childish or like a stereotypical sci-fi game.

---

## 31. Navigation

The user does not want a conventional website full of tabs.

Navigation is fully spatial (see §6): no visible menus, header, logo bar or minimap.

Usability still comes before novelty: every place is visible from the overview and one click away.

For keyboard and screen-reader users there is a hotspot button per place, **only visible when it receives keyboard focus**; direct URLs work for every place and project; without WebGL a text version with ordinary navigation is shown.

---

## 32. Cursor

A custom cursor may be introduced if it genuinely improves the interaction.

Possible behavior:

- normal cursor state
- interactive state
- project exploration state
- drag/3D state

Do not use a custom cursor merely because it is fashionable.

It must remain usable and must not hide important feedback.

---

## 33. Scroll

The page itself does not scroll. In the world, the scroll wheel / pinch zooms the camera a little (within limits).

Panels scroll normally inside themselves (e.g. a long case study).

---

## 34. Audio

Audio is a deliberate **easter egg in the FOH tent**:

- At the FOH desk the visitor chooses a track, starts and stops it, and can control the stage lights.
- The music plays from the **speakers on the terrain** as positional audio: moving towards a booth on the right makes the stage sound come more from the left, like at a real festival. The sound may also react to where the cursor looks.
- Tracks are NCS songs supplied by Wout, stored in a folder with their title/artist listed as data; the FOH shows the credit while a track plays. Check NCS's usage terms for websites.
- **Never autoplay.** While music plays, a mute button appears next to the language toggle.

Project videos may contain their own audio.

---

## 35. Accessibility

The site is experimental, but must still be usable.

Important content must remain accessible without:

- precise mouse movement
- hover-only interactions
- audio
- WebGL
- extreme animation

Support reduced motion.

Use semantic HTML where appropriate.

Provide accessible names/labels for interactive controls.

---

## 36. SEO

Even though the portfolio is immersive, it must remain discoverable.

Include:

- meaningful page titles
- meta descriptions
- semantic headings
- descriptive project titles
- useful alt text
- Open Graph metadata where practical

Do not sacrifice direct project URLs solely for the immersive concept.

---

## 37. Avoiding an AI-generated look

This is a major design requirement.

Avoid the common visual language of generic AI-generated portfolios:

- purple/blue gradients everywhere
- excessive glowing text
- random floating 3D objects
- meaningless particles
- giant generic hero statements
- excessive glass cards
- excessive rounded rectangles
- fake dashboards
- decorative code snippets with no purpose
- meaningless animated statistics
- generic AI-generated illustrations

Every major visual element should have a reason to exist.

The site should feel designed around Wout's work rather than around a collection of fashionable web effects.

---

## 38. Professionalism

The site should be experimental without sacrificing professional credibility.

A recruiter should quickly be able to understand:

- who Wout is
- what he studies
- what he can build
- what technologies he uses
- which projects he has completed
- what role he played
- how to contact him
- how to download his CV

The immersive layer should enhance these goals, not hide them.

---

## 39. Content honesty

Never invent:

- job experience
- internship experience
- project results
- client names
- awards
- technologies
- responsibilities
- project metrics
- user counts
- performance results
- professional claims

When information is missing, ask Wout.

---

## 40. Future expansion

The architecture should make future additions easy.

Possible future content:

- new projects
- new LAB experiments
- new technologies
- new case studies
- new media types
- WebXR experiences
- 3D environments
- additional social links
- updated CV
- future work experience

Adding a project should primarily involve editing/adding data and media, not rewriting the portfolio architecture.

---

## 41. Suggested project structure

```text
Portfolio2/
├── CLAUDE.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
│
├── docs/
│   └── BRIEF.md
│
├── public/
│   ├── assets/
│   └── cv/
│
└── src/
    ├── components/
    ├── data/
    │   ├── projects.json
    │   ├── skills.json
    │   └── i18n/
    │       ├── nl.json
    │       └── en.json
    ├── pages/
    ├── styles/
    ├── three/
    └── utils/
```

This structure is a starting point, not a reason to create folders before they are needed.

---

## 42. Commands and Git

Development commands, deployment, and Git conventions are defined in `CLAUDE.md`.

---

## 43. Build order

The project setup, content model, translations, case studies, contact form and deployment already exist (built for v1, reused). The festival is built in this order:

1. **Greybox**: the terrain with simple blocks (entrance, stage, FOH, booths), camera look-around/orbit, hover + click to travel, HTML panels with the existing content, routes per place. Validate that exploring *feels* good before modelling.
2. Accessibility and fallback: focus-visible hotspots, panel focus management, reduced motion, no-WebGL text version.
3. Mobile: touch controls, bottom-sheet panels, lower detail.
4. Low-poly models from Blender (booths, stage, FOH, props) replacing the greybox blocks; lighting and night atmosphere.
5. Booth interiors: the Projects menu, Lab items, Merch CV, info point.
6. FOH easter egg: music (positional audio, credits, mute button) and light control.
7. Performance pass (model sizes, on-demand rendering, loading) and final checks.

Do not model or polish before the greybox interaction feels right.

---

## 44. Final design principle

The portfolio should feel like:

> **A professional XR developer's digital world that happens to be a portfolio.**

Not:

> **A normal portfolio with some 3D effects added to it.**

The technology should support the story of Wout's work.

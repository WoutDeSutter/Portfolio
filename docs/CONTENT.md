# Adding and editing content

All portfolio content lives in `src/data/`. You never need to touch React or Three.js code to add a project: the pages, the floor plan and the 3D stage are generated from these files.

| File | What it holds |
|---|---|
| `src/data/projects.json` | Every project: kind, status, technologies, media, links, demo. **No text.** |
| `src/data/i18n/en.json` | All English text, including project titles and case studies |
| `src/data/i18n/nl.json` | The same keys in Dutch |
| `src/data/skills.json` | Technologies you can reference from projects |
| `src/data/site.json` | Contact details, CV file, contact-form id |

`en.json` and `nl.json` must always contain the same keys. While `npm run dev` is running, the browser console warns about keys that exist in one file but not the other.

## 1. Add a project to `projects.json`

```json
{
  "slug": "tagrun",
  "kind": "featured",
  "status": "completed",
  "year": 2026,
  "categories": ["XR", "Interactive"],
  "technologies": ["unity", "csharp"],
  "media": [],
  "links": [],
  "demo": { "enabled": false }
}
```

| Field | Values | Notes |
|---|---|---|
| `slug` | lowercase-with-dashes | Used in the URL: `/#/projects/tagrun`. Don't change it once shared. |
| `kind` | `featured`, `project`, `lab` | `featured` → large case study + projection screen on the stage. `project` → compact + flight case. `lab` → LAB page + object on the workbench. |
| `status` | `concept`, `in-progress`, `completed`, `archived` | |
| `year` | number | Optional. |
| `technologies` | ids from `skills.json` | e.g. `"unity"`, `"csharp"`, `"esp32"`. The About page links each skill to the projects that use it. |
| `media` | see below | The first image/video is the hero; the rest becomes the gallery. |
| `links` | see below | |
| `demo` | see below | |

The order in `projects.json` is the order on the Work and Lab pages (featured projects are always listed first on Work).

## 2. Add the text to `en.json` and `nl.json`

Under `"projects"`, add an entry with the same slug:

```json
"tagrun": {
  "title": "TagRun",
  "summary": "One or two sentences shown in lists and at the top of the case study.",
  "sections": {
    "overview": "First paragraph.\n\nA blank line (\\n\\n) starts a new paragraph.",
    "role": "What you did in this project.",
    "result": "What came out of it."
  }
}
```

`title` and `summary` are required. Every section is optional — only the sections you write are shown, in this order:

`overview` · `problem` · `concept` · `development` · `interaction` · `role` · `challenges` · `result`

Small projects can have only a summary; featured projects can use all sections.

## 3. Media

Put files in `public/media/<slug>/` and reference them **without a leading slash**:

```json
"media": [
  { "type": "image", "src": "media/tagrun/hero.jpg", "altKey": "projects.tagrun.media.hero" },
  { "type": "video", "src": "media/tagrun/gameplay.mp4", "poster": "media/tagrun/gameplay.jpg", "captionKey": "projects.tagrun.media.gameplay" }
]
```

- `altKey` / `captionKey` point to text in the language files, e.g. `"media": { "hero": "Player tagging an opponent in the XR arena" }` inside `projects.tagrun`.
- The **first image** is also projected on the project's screen on the 3D stage (featured projects).
- Images: prefer `.jpg`/`.webp`, around 1600 px wide and under ~300 kB. Videos: `.mp4` (H.264), with a `poster` image; they only load when played.

## 4. Links

```json
"links": [
  { "type": "github", "url": "https://github.com/..." },
  { "type": "apk", "url": "media/tagrun/tagrun.apk" }
]
```

Types: `github`, `demo`, `apk`, `external`, `download`. Labels are translated automatically.

## 5. Interactive demo (optional)

```json
"demo": { "enabled": true, "type": "webgl", "url": "https://example.com/tagrun-demo/" }
```

- `type`: `webgl` or `webxr` → shown in an embedded frame, **only after the visitor clicks "Load demo"**. `external` → just a link that opens in a new tab.
- Set `"enabled": false` to hide a demo without deleting its URL.
- Embedded demos must allow being shown in an iframe; if a site refuses that, use `external`.

## 6. Site details (`site.json`)

```json
{
  "contact": {
    "email": "you@example.com",
    "linkedin": "https://www.linkedin.com/in/...",
    "github": "https://github.com/WoutDeSutter",
    "discord": "username"
  },
  "cv": { "file": "cv/wout-de-sutter-cv.pdf" }
}
```

Empty values are hidden on the site. Put the CV in `public/cv/`.

## Check your changes

```bash
npm run build
```

A successful build means the JSON is valid and the site compiles. Then check the project page in `npm run dev` in both languages.

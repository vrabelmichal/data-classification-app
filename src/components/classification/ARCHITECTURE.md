# ClassificationInterface Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ClassificationInterface.tsx                 │
│                     (Main Orchestrator)                      │
│  • Manages top-level state (contrast, screen size, etc.)    │
│  • Handles keyboard shortcuts                                │
│  • Coordinates navigation and submission                     │
│  • Renders mobile or desktop layout                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ├── Uses Custom Hooks ──────────────┐
                          │                                    │
                          ▼                                    ▼
          ┌──────────────────────────┐      ┌──────────────────────────┐
          │ useClassificationForm    │      │ useClassificationNavigation│
          │ • Form state management  │      │ • Navigation logic        │
          │ • Quick input parsing    │      │ • Previous/Next handlers  │
          │ • Auto-load existing     │      └──────────────────────────┘
          └──────────────────────────┘
                          │
                          ├── Renders Components ─────────────┐
                          │                                    │
          ┌───────────────┼────────────────────┬──────────────┴──────┐
          │               │                    │                     │
          ▼               ▼                    ▼                     ▼
  ┌──────────────┐ ┌──────────────┐  ┌──────────────┐    ┌──────────────┐
  │ QuickInput   │ │ GalaxyImages │  │ GalaxyInfo   │    │ Classification│
  │              │ │              │  │              │    │ Form          │
  │ • Text input │ │ • Image grid │  │ • Metadata   │    │               │
  │ • Shortcuts  │ │ • Ellipse    │  │ • Details    │    │ • LSB radio   │
  └──────────────┘ │   overlay    │  │   toggle     │    │ • Morph radio │
                   └──────────────┘  └──────────────┘    │ • Flags       │
                                                          │ • Comments    │
                                                          └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ ActionButtons│
                   │              │
                   │ • Submit     │
                   │ • Skip       │
                   │ • Prev/Next  │
                   └──────────────┘

═══════════════════════════════════════════════════════════════

Supporting Modules:

┌──────────────────────────────────────────────────────────────┐
│                         helpers.tsx                           │
│  • parseQuickInput()      • filterQuickInput()               │
│  • buildQuickInputString() • getImagePriority()              │
│  • processImageLabel()     • shouldShowEllipse()             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     detailRenderers.tsx                       │
│  • renderSersic()          • renderSourceExtractor()         │
│  • renderPhotometryBlock() • renderThuruthipilly()           │
│  • renderAdditionalDetails()                                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                         types.ts                              │
│  • ClassificationFormState  • GalaxyData                     │
│  • ClassificationOption     • NavigationState                │
│  • ImageType                • UserPreferences                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       constants.ts                            │
│  • LSB_OPTIONS          • MORPHOLOGY_OPTIONS                 │
│  • ALLOWED_QUICK_INPUT_CHARS                                 │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Quick Input or  │
│ Form Controls   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Form State      │◄─── useClassificationForm
│ (LSB, Morph,    │
│  flags, etc.)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Submit/Skip     │
│ Handler         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Convex Mutation │
│ (Backend)       │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Navigate        │◄─── useClassificationNavigation
│ (Prev/Next)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ New Galaxy      │
│ Loaded          │
└─────────────────┘
```

## Component Hierarchy

```
ClassificationInterface
├── Header
│   ├── Title (Galaxy ID)
│   ├── Position Info
│   └── Controls (Ellipse toggle, Help)
│
├── Main Content (Mobile OR Desktop layout)
│   │
│   ├── Desktop Layout (3-column grid)
│   │   ├── Left Panel (2 cols)
│   │   │   ├── GalaxyImages
│   │   │   ├── GalaxyInfo
│   │   │   └── Action Links (Aladin, Contrast)
│   │   │
│   │   └── Right Panel (1 col)
│   │       ├── QuickInput
│   │       ├── ClassificationForm
│   │       └── ActionButtons
│   │
│   └── Mobile Layout (stacked)
│       ├── ClassificationForm
│       ├── ActionButtons
│       ├── GalaxyImages
│       ├── GalaxyInfo
│       └── Action Links
│
├── Footer
│   └── ProgressBar
│
└── Modals
    └── KeyboardShortcuts
```

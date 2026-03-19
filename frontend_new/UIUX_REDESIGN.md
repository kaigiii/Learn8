# Learn8: Gamified Learning Platform - Frontend Blueprint
> **[Agent Directive]**
> You are an expert Frontend AI Architect. Your task is to execute a complete Consumer-Facing UI/UX build for a brand new application named "Learn8" based *strictly* on this manual. 
> 
> You do NOT need any prior context about any existing backend. You are building a **Pure Frontend Prototype** that uses local state (Zustand + LocalStorage) and embedded Mock Data to simulate a flawless, gamified learning experience (similar to Duolingo or Brilliant).
> 
> Create the directory structure implicitly based on modern Next.js 14+ conventions.

---

## 🌟 1. Project Introduction: What is Learn8?

**Learn8** is a next-generation adaptive learning platform that transforms static, boring knowledge (like PDFs, textbooks, or notes) into an immersive, gamified "Infinite Game." 

Unlike traditional LMS (Learning Management Systems) or static flashcard apps, Learn8 dynamically breaks down knowledge into a visual "Skill Tree" (Syllabus Map). Each concept or exercise is delivered through highly interactive, bite-sized mini-games:
- Dragging and dropping anatomy labels (`SpatialAnatomy`)
- Arranging logical sequences of events (`LogicChain`)
- Categorizing abstract concepts into buckets (`TaxonomyMatrix`)

**The Goal**: Make learning feel less like reading a textbook and more like exploring a universe and leveling up a character.

---

## 🖼️ 2. Screen-by-Screen Layout Specifications (The Blueprint)

This section defines the precise visual layout and components present on every major screen to ensure a seamless flow.

### Screen A: Welcome & Authentication (`/app/(onboarding)/login/page.tsx`)
**Vibe**: Inviting, frictionless, premium.
- **Background**: Slow-moving ambient glow (e.g., deep blue with a soft purple aura).
- **Layout**: Centered `DeepGlassCard`.
- **Content**:
  - *Header*: The Learn8 Logo (glowing) and a short tagline ("Unlock the Infinite Game").
  - *Main*: Large, prominent "Continue with Google/Apple" buttons (using sleek icons).
  - *Divider*: "Or continue with email" (subtle text).
  - *Inputs*: Elegant email/password fields with floating labels. Border glows on focus.
  - *Action*: "Start exploring" button.
- **Transitions**: Upon success, fluidly scales up the card and fades into the Onboarding Survey.

### Screen B: Onboarding Survey (`/app/(onboarding)/welcome/page.tsx`)
**Vibe**: Immersive, mysterious, welcoming. Like character creation in an RPG.
- **Background**: Continues seamlessly from the login screen.
- **Center Focus**: A `DeepGlassCard` (max-width: 2xl) acting as a conversational carousel.
  - *Top*: A friendly greeting/header ("Welcome Explorer").
  - *Middle*: An animated selection grid for topics (e.g., Tech, History, Med) or a single elegant text input for their name/goal.
  - *Bottom*: A "Next" or "Start Journey" `GameButton` that pulses.
- **Transitions**: Slide in/out using `framer-motion` `AnimatePresence` as the user answers 2-3 questions. Routes to Dashboard upon completion.

### Screen C: The Learning Hub / Dashboard (`/app/(dashboard)/home/page.tsx`)
**Vibe**: The player's home base. Clean, structured, motivating.
- **Top Navigation Bar (Sticky)**: `TopStatsBar`
  - *Left*: User Avatar / Mascot icon. Clicking opens the Profile/Settings modal.
  - *Right*: 
    - 🔥 Streak Count (e.g., "12 Days")
    - 💎 Gem Balance (e.g., "1,500"). Clicking this routes to the Top-Up Store.
    - 🛡️ Current Rank/Level Badge.
- **Hero Section (Top Center)**: "Continue Journey" Card.
  - A wide `DeepGlassCard`. Displays a thumbnail of the current active course, a progress bar (e.g., "75% complete"), and a massive, glowing "Resume" button.
- **Secondary Section (Middle)**: "Forge a New Universe" (Upload Zone).
  - A beautifully styled dashed border dropzone using `framer-motion` for a hover scaling effect.
  - *Center icon*: A glowing magical portal or book.
  - *Text*: "Drop a PDF or enter a topic to forge a new learning path." (Simulates routing to The Forge on click).
- **Bottom Section**: "Your Library" - A horizontal scrollable list or grid of generic course thumbnails.

### Screen D: The Treasury / Top-Up Store (`/app/(dashboard)/store/page.tsx`)
**Vibe**: Premium, enticing, rewarding.
- **Top Navigation Bar (Sticky)**: Same `TopStatsBar` as Dashboard, but the "Back" arrow replaces the Avatar.
- **Header**: "The Treasury: Fuel Your Journey" - Get Gems (💎) to forge new courses or ask for hints.
- **Layout**: A row of 3 `DeepGlassCard` pricing tiers centered on screen:
  - **Tier 1 (Starter)**: "Handful of Gems (500 💎)" - Minimalist design.
  - **Tier 2 (Popular)**: "Chest of Gems (2000 💎)" - Emits a slight glow, features a "Best Value" ribbon/badge in the corner.
  - **Tier 3 (Pro Learner)**: "Infinite Energy Subscription" - Distinct color styling (e.g., gold or neon purple background with animated gradients).
- **Interactions**: Clicking a tier opens a sleek, native-feeling fake payment modal (e.g., an Apple Pay style slide-up modal from the bottom).

### Screen E: User Profile & Settings Modal
**Vibe**: Personalized, highly polished dashboard.
- **Interaction**: This is NOT a separate page. It is an overlay (`AnimatePresence` modal) triggered by clicking the Avatar in the Top Navigation.
- **Layout**: Centered, tall `DeepGlassCard`.
- **Content**:
  - *Header*: Huge Avatar with an "Edit" icon overlay. Username and Title (e.g., "Level 5 Quantum Scholar").
  - *Stats Grid*: Total XP earned, Longest Streak, Courses Completed.
  - *Preferences*: Toggles for "Sound Effects", "Dark/Light Theme" (though default is Dark Glass), and "Difficulty scaling".
  - *Danger Zone*: A subtle "Log Out" button at the very bottom.

### Screen F: The Forge (Loading/Generation) (`/app/forge/page.tsx`)
**Vibe**: High-tech, anticipation.
- **Layout**: Full screen, hiding all navigation.
- **Center**: A pulsing, complex SVG animation (like an atom, a neural network, or a magical anvil forging rings).
- **Text (Below Animation)**: Large, dynamic typewriter text updating via `setTimeout` every 2 seconds:
  - "Scanning document..." -> "Extracting key concepts..." -> "Forging interactive stages..."
- **Transition**: Ends with a bright flash (white screen) leading directly to the Syllabus Map.

### Screen G: Syllabus Map / Skill Tree (`/app/(dashboard)/map/[courseId]/page.tsx`)
**Vibe**: Exploration, non-linear progression.
- **Top Bar**: Standard `TopStatsBar` with a "Back to Hub" arrow on the left.
- **Main Area**: A massive scrolling (or simple vertical) canvas.
  - *Path*: A winding SVG dashed line connecting nodes from bottom to top or left to right.
  - *Nodes*: Circular icons representing "Units" or "Concepts".
    - *Locked*: Grayed out, padlock icon. Not clickable.
    - *Available*: Full color, slowly breathing (scaling up and down slightly), surrounded by a glowing aura.
    - *Completed*: Gold/Green color, checkmark or star icon.
- **Interaction**: Clicking an *Available* node triggers an immediate route change to the Arena.

### Screen H: The Arena (Stage Player) (`/app/(arena)/play/[nodeId]/page.tsx`)
**Vibe**: Absolute focus. Zero distractions.
- **Top Navigation (Minimalist)**: 
  - *Left*: A discreet "X" to exit (triggers a "Lose progress?" warning modal).
  - *Center*: `TopProgressBar`. A sleek, continuous line that fills up smoothly as stages are passed.
  - *Right*: Empty (keep distraction-free).
- **Center Stage (The Game Area)**:
  - Occupies 70% of the screen.
  - Renders the specific interactive component (`LogicChain`, `TaxonomyMatrix`, etc.). Elements must be large, chunky, and touch/drag-friendly.
- **Bottom Action Area**:
  - *Floating Mascot (Bottom Right Corner)*: Thinks/reacts. Clickable to ask for a "Hint" (deducts 10 💎 gems).
  - *Action Bar (Fixed at bottom)*: A full-width `GameButton` saying "CHECK".
- **Feedback Overlay (Bottom Sheet)**: 
  - Upon clicking "CHECK", a colored panel slides up from the bottom edge covering the Action Bar.
  - *If Correct*: Panel is bright green. Plays a success chime. Confetti explodes on screen. Button changes to "CONTINUE".
  - *If Incorrect*: Panel is red/orange. Plays an error buzz and shakes the screen physically. Displays the `feedback.error` message and a hint. Button changes to "GOT IT".

### Screen I: Victory Screen (`/app/(arena)/play/[nodeId]/result/page.tsx`)
**Vibe**: Celebration, dopamine hit.
- **Background**: Darkens with a spotlight effect.
- **Animations**: Massive confetti burst. A giant 3D-looking chest or star drops into the center with a bounce physics effect (`y: -100` to `0`).
- **Stats Presentation**:
  - "LESSON CLEARED!" large header.
  - A card slides up showing tally counters rolling quickly from 0:
    - Accuracy: 100%
    - Time: 2m 14s
    - XP Gained: +50 XP
  - An XP bar dynamically fills up, triggering a "Level Up!" flash if it crosses a threshold defined in `useUserStore`.
- **Bottom**: A massive, glowing "Back to Map" button that routes the user back, initiating the unlock animation of the next node.

### Universal State: Graceful Errors & Empty States
**Vibe**: Forgiving, helpful.
- **Empty Library**: Instead of a blank space, show a ghosted illustration of an empty bookshelf and a pulsing arrow pointing to the "Forge" dropzone.
- **404/Error**: A friendly Mascot looking confused with a "Let's get you back home" button. Never show a raw stack trace.

---

## 🏗️ 3. Technical Stack & Foundation

*   **Framework**: Next.js 14+ (App Router).
*   **Styling**: Tailwind CSS (with specific arbitrary values for glassmorphism).
*   **Icons**: `lucide-react`.
*   **Animation**: `framer-motion` (Mandatory for all page transitions, modal popups, and button interactions).
*   **Confetti/Effects**: `react-canvas-confetti` (For victory screens).
*   **State Management**: `zustand` (Used extensively to replace backend APIs).

### The UX Philosophy
*   **Zero Developer UI**: Remove all JSON viewers, "Debug" sidebars, "System Admin" panels, and raw data dumps.
*   **The Ultimate Glassmorphism (iOS 26 Style)**: Cards and overlays must use deep blurring combined with extremely subtle SVG noise textures to prevent color banding and add premium physical realism.

### Frontend Architecture Patterns
*   **Feature-Sliced Design (FSD) Lite**: Group components, stores, and hooks by domain/feature (e.g., `features/arena`, `features/dashboard`) rather than technical type, keeping related logic co-located.
*   **Container / Presentational Pattern**: Keep complex React components separated. The "Container" (e.g., `/app/(arena)/play/[nodeId]/page.tsx`) handles Zustand store reading and routing. "Presentational" components (e.g., `SpatialAnatomy.tsx`) only receive props and emit events, remaining completely pure and testable.
*   **Store Segregation (Zustand)**: Do not use one monolithic store. Segment by domain:
    - `useUserStore`: Global persisted state (XP, streaks, preferences).
    - `useCourseStore`: Domain data (curriculum structure, node unlock states).
    - `useArenaStore`: Ephemeral local state (current question index, animation triggers during a game session).
*   **Animation Driven Flow**: Do not rely strictly on instantaneous state changes. Use `framer-motion`'s `onAnimationComplete` callbacks to trigger state updates (e.g., unlocking a node only *after* the victory confetti finishes).

---

## 💎 4. The Core UI Component: `DeepGlassCard`

Whenever you need a container (dashboard tiles, store tiers, map nodes, feedback modals), use this specific implementation to achieve the required "iOS 26 Premium Glass" aesthetic. 

```tsx
"use client";
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
// Assume `cn` is a standard class merging utility (like clsx + twMerge)
import { cn } from '@/lib/utils'; 

interface DeepGlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function DeepGlassCard({ children, className, ...props }: DeepGlassCardProps) {
  return (
    <motion.div 
      className={cn(
        "relative group rounded-3xl p-8 overflow-hidden",
        "bg-slate-900/40",                              // Dark mode glass base
        "backdrop-blur-[40px] saturate-150",            // Heavy blur and color boost
        "border border-white/10",                       // Edge highlight
        /* Thickness (top inner glow) and soft environment drop shadow */
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.3)]",
        "transition-all duration-500 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_16px_48px_rgba(0,0,0,0.4)]",
        className
      )}
      {...props}
    >
      {/* The Noise Texture layer: crucial for physical realism (prevents color banding) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
           }}
      />
      
      {/* Content Layer */}
      <div className="relative z-10 text-white">
        {children}
      </div>
      
      {/* Dynamic light reflection on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    </motion.div>
  );
}
```

---

## 🗂️ 5. Next.js App Router Structure & Implementation

Structure the application exactly as follows. 

```text
src/
├── app/
│   ├── layout.tsx                     # Global App layout (Include modern sans-serif fonts)
│   ├── globals.css                    # Tailwind directives + custom @layer utilities
│   ├── (onboarding)/                  # Route Group 1: First-time entry
│   │   ├── login/page.tsx             # The premium Welcome/Auth screen (Screen A)
│   │   └── welcome/page.tsx           # Interactive "Sorting Hat" questionnaire (Screen B)
│   ├── (dashboard)/                   # Route Group 2: The Hub
│   │   ├── layout.tsx                 # Contains the Top Navigation Bar (Avatar, Streak, Gems)
│   │   ├── home/page.tsx              # "Continue Journey" & "Create New Universe" dropzone (Screen C)
│   │   ├── store/page.tsx             # The Treasury Top-up Center (Screen D)
│   │   └── map/[courseId]/page.tsx    # The non-linear Skill Tree / Island Map view (Screen G)
│   ├── (arena)/                       # Route Group 3: The Active Learning Zone
│   │   └── play/[nodeId]/             # The Stage Player (No navigation bars allowed, pure focus) (Screen H)
│   │       ├── page.tsx               
│   │       └── result/page.tsx        # The Victory Celebration (Screen I)
│   └── forge/page.tsx                 # The "Fake Loading" screen mocking AI generation (Screen F)
│
├── components/
│   ├── ui/                            # Reusable base components
│   │   ├── DeepGlassCard.tsx          # ⭐ The core container
│   │   ├── GameButton.tsx             # framer-motion wrapped button with scale-down tap
│   │   ├── TopProgressBar.tsx         # Fills up smoothly as stages are completed
│   │   └── MascotHint.tsx             # Floating right-bottom character for AI hints
│   └── shared/
│       ├── TopStatsBar.tsx            # Renders Rank, Fire 🔥, and Diamond 💎 icons
│       └── ProfileModal.tsx           # The slide-up Settings/Profile overlay (Screen E)
│
├── stores/                            # Pure Frontend Backend (Zustand + Persist)
│   ├── useUserStore.ts                # App State: xp, level, streak, gems, lastActiveNodeId
│   ├── useCourseStore.ts              # App State: Loads mock data, tracks unlocked nodes
│   └── useArenaStore.ts               # Local State: currentStageIndex, isCorrect, showFeedback
│
└── data/                              # Mock Data Sources (See Section 6)
    ├── mock_medicine.ts               
    └── mock_calculus.ts               
```

---

## 🧪 6. Pure Frontend Mock Data Context

To allow immediate UI construction without backend schema definitions, you must use these EXACT two datasets as your single source of truth for the curriculum structure. The UI must dynamically render the `stage.component` string into an actual interactive view.

### Mock 1: Medicine (Cardiovascular)
```typescript
// Path: src/data/mock_medicine.ts
export const mockMedicineUnit = {
    unitId: "med-u1",
    unitTitle: "The Heart & Blood Flow",
    nodes: [
        {
            id: "med-n1",
            title: "Heart Chambers (心臟結構)",
            description: "Identify the spatial anatomy of the heart.",
            type: "concept",
            status: "available", // Only the first node is unlocked
            stages: [
                {
                    stageId: "med-s1",
                    topic: "Identify the Left Ventricle",
                    module: "Instruction",
                    component: "SpatialAnatomy",
                    skin: "Scientific",
                    config: {
                        data: {
                            model: "heart-cross-section",
                            labels: [
                                { id: "ra", label: "Right Atrium" },
                                { id: "rv", label: "Right Ventricle" },
                                { id: "la", label: "Left Atrium" },
                                { id: "lv", label: "Left Ventricle" }
                            ]
                        },
                        initialState: {}
                    },
                    validation: { type: "exact", condition: { target: "lv" } },
                    feedback: { 
                        success: "Correct! The Left Ventricle pumps blood to the entire body.", 
                        error: "Incorrect. Hint: Look at the thicker muscular wall at the bottom right of the diagram.",
                        hint: "Where is the thickest muscle needed?"
                    }
                }
            ]
        },
        {
            id: "med-n2",
            title: "Circulation Path (血液循環)",
            description: "Arrange the flow of deoxygenated blood.",
            type: "exercise",
            status: "locked",
            stages: [
                {
                    stageId: "med-s2",
                    topic: "Pulmonary Circulation",
                    module: "Practice",
                    component: "LogicChain",
                    skin: "Classic",
                    config: {
                        data: {
                            nodes: [
                                "Superior Vena Cava", 
                                "Right Atrium", 
                                "Right Ventricle", 
                                "Pulmonary Artery",
                                "Lungs"
                            ]
                        },
                        initialState: {}
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { 
                        success: "Perfect Sequence! You understand the path to the lungs.", 
                        error: "Not quite. Remember blood enters the atrium before the ventricle.",
                        hint: "Veins -> Atrium -> Ventricle -> Artery"
                    }
                }
            ]
        }
    ]
};
```

### Mock 2: Calculus (Limits & Derivatives)
```typescript
// Path: src/data/mock_calculus.ts
export const mockCalculusUnit = {
    unitId: "calc-u1",
    unitTitle: "Limits & Derivatives",
    nodes: [
        {
            id: "calc-n1",
            title: "Concept of Limits",
            description: "Classify scenarios where limits exist or fail.",
            type: "concept",
            status: "available",
            stages: [
                {
                    stageId: "calc-s1",
                    topic: "Limit Existence",
                    module: "Instruction",
                    component: "TaxonomyMatrix",
                    skin: "Code",
                    config: {
                        data: {
                            buckets: ["Limit Exists", "Limit Does Not Exist"],
                            items: [
                                { id: "limit1", content: "Left limit = 5, Right = 5" },
                                { id: "limit2", content: "Left limit = 3, Right = -3 (Jump)" },
                                { id: "limit3", content: "Approaches infinity (Asymptote)" },
                                { id: "limit4", content: "Continuous polynomial" }
                            ]
                        },
                        initialState: { assignments: {} }
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { 
                        success: "Excellent classification! Limits require agreement from both sides.", 
                        error: "Check the definitions of jumps and asymptotes.",
                        hint: "If left and right don't match, it doesn't exist."
                    }
                }
            ]
        },
        {
            id: "calc-n2",
            title: "Derivative Rules",
            description: "Match base functions to their derivatives.",
            type: "exercise",
            status: "locked",
            stages: [
                {
                    stageId: "calc-s2",
                    topic: "Basic Differentiation",
                    module: "Practice",
                    component: "PatternMatcher",
                    skin: "Scientific",
                    config: {
                        data: {
                            pairs: [
                                { id: "diff1", left: "f(x) = x³", right: "f'(x) = 3x²" },
                                { id: "diff2", left: "f(x) = sin(x)", right: "f'(x) = cos(x)" },
                                { id: "diff3", left: "f(x) = eˣ", right: "f'(x) = eˣ" },
                                { id: "diff4", left: "f(x) = ln(x)", right: "f'(x) = 1/x" }
                            ]
                        },
                        initialState: {}
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { 
                        success: "All matched! You master the basic power and transcendental rules.", 
                        error: "Review your trig and exponential derivatives.",
                        hint: "The derivative of eˣ is special!"
                    }
                }
            ]
        }
    ]
};
```

---
> **[End of Directives]** Ensure every file you create adheres strictly to the specifications laid out above. Build the entire ecosystem mock-first without any backend connections.

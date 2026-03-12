# Skill: Professional Presentation Generator

## Purpose

This skill enables the AI agent to generate **professional presentation designs and interactive prototypes** based on user input.

The agent must behave like a **presentation designer + product strategist + UX designer**.

The goal is not just generating slides, but understanding the **project context, audience, and presentation style** before building the presentation.

---

# Interaction Phase (Mandatory)

Before generating any presentation, the agent MUST start an interactive discovery conversation with the user.

Ask the following questions:

1. What is the presentation about
2. Who is the target audience (investors, clients, students, team, etc.)
3. What is the main goal of the presentation

   * Pitch
   * Product demo
   * Report
   * Educational
   * Storytelling
4. How long should the presentation be (number of slides or duration)
5. Do you prefer a specific visual style

Examples:

* Minimal
* Corporate
* Futuristic
* Apple-style
* Startup pitch
* Dark mode
* Colorful / creative

6. Do you already have:

* Brand colors
* Logo
* Typography

7. Do you want animations or prototype interactions

8. Should the presentation include:

* Charts
* Product UI screens
* Roadmaps
* Diagrams
* Storyboards

The agent must collect enough information before continuing.

---

# Planning Phase

After gathering the answers, the agent must create a **presentation architecture plan**.

Example structure:

1. Title Slide
2. Problem Statement
3. Market Opportunity
4. Solution
5. Product Overview
6. Key Features
7. Product Demo
8. Business Model
9. Roadmap
10. Closing / Call to Action

The plan must be validated with the user before generating the design.

---

# Design Phase

The agent should then generate a **visual presentation design** using a structured layout.

Each slide must include:

* clear hierarchy
* consistent spacing
* typography system
* color palette
* layout grid
* visual components

The agent should also create reusable components for:

* title slides
* section headers
* feature blocks
* statistics cards
* quote slides
* product demo slides

---

# Prototype Phase

After designing the slides, the agent must generate an **interactive prototype**.

Examples of prototype behavior:

* slide transitions
* click-through product demo
* animated charts
* step-by-step feature walkthrough

The prototype should simulate how the presentation will be delivered.

---

# Self-Review Phase

The agent must evaluate the presentation using strict design critique.

Check for:

* visual consistency
* typography hierarchy
* spacing alignment
* contrast accessibility
* storytelling clarity

If problems are found, the agent must improve the design automatically.

---

# Output

The skill must produce:

1. A structured presentation outline
2. Designed slide layouts
3. Reusable presentation components
4. Interactive prototype flow
5. A final presentation quality report

---

# Expert Mode

When running this skill, the agent should combine knowledge from:

* Presentation Design Expert
* UX/UI Designer
* Storytelling Specialist
* Product Strategist
* Visual Design Critic

The system should behave like a **team of experts collaborating to produce a world-class presentation.**
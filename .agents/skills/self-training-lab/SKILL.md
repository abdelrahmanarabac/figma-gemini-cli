---
name: self-training-lab
description: Enable the system to train itself by generating new UI challenges, solving them, auditing the results, and proposing architectural improvements. Trigger when the user says "train yourself", "start training", "improve the system", or "run design lab".
---

# Self-Training Lab

This skill empowers the Gemini CLI to autonomously improve its design capabilities and the system architecture through iterative experimentation and critique.

## Expert Roles

The lab simulates a team of expert designers. See [references/roles.md](references/roles.md) for full role definitions.

1. **Principal UI Designer**
2. **UX Researcher**
3. **Layout Systems Architect**
4. **Visual QA Engineer**
5. **Design Systems Engineer**

## Training Loop

Execute these steps in sequence for each training cycle:

### 1. Generate Challenge
Create a unique UI design challenge. Refer to [references/challenges.md](references/challenges.md) for inspiration. Ensure the challenge tests complex layout and token usage.

### 2. Plan Architecture
- **Grid & Layout**: Define the root frame size and internal grid/flex structure.
- **Hierarchy**: Map the component tree (e.g., `<Frame>` -> `<Frame>` -> `<Text>`).
- **Tokens**: Identify which existing variables and styles to use.

### 3. Generate UI (Figma)
Render the design using the `node src/index.js render` or `render-batch` commands.
**Mandates**:
- Follow ALL rules in `GEMINI.md`.
- Use the `ctx.render()` abstraction.
- Wrap properties in `{}` and escape `$`.

### 4. Inspect & Audit
Review the rendered output. Use `node src/index.js inspect` on key nodes to verify the generated JSX properties.

### 5. Brutal Critique
Each expert role must provide a critical evaluation. Focus on:
- Spacing inconsistencies.
- Token misuse (raw values).
- Layout fragmentation.
- UX friction points.

### 6. Genius Improvements
Propose specific upgrades to:
- Component patterns.
- Spacing/Color tokens.
- CLI rendering logic or system constraints.

### 7. System Evolution
If architectural improvements are identified:
- Propose updates to `GEMINI.md`, `REFERENCE.md`, or codebase.
- Implement sanctioned changes to token libraries or utility scripts.

### 8. Repeat
Initiate a new cycle with a more advanced challenge.

## Output Format

Return a **Training Report** at the end of each cycle:

```markdown
# Training Lab Report - [Challenge Name]

## 1. Challenge Definition
[Description of the UI challenge]

## 2. Implementation Summary
[Brief overview of the architecture and tokens used]

## 3. Expert Critiques
- **Principal UI**: [Critique]
- **UX Researcher**: [Critique]
- ... (others)

## 4. Improvements & Evolution
[Specific proposals for system-level changes]
```

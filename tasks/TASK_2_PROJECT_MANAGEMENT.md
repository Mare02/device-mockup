# TASK 2: Project Management & Mockup Workflows

## Objective
Enable users to manage multiple "Projects" that contain one or more device mockups. Manage guest vs. logged-in user experiences.

## Requirements
- [ ] **Guest Mode**: 
    - [ ] Guests can use the tool but see a "Log in to save" banner.
    - [ ] Saving triggers the Clerk signup/signin flow.
- [ ] **Logged-in Users**:
    - [ ] Can create multiple "Projects".
    - [ ] Can save current mockup state to a project.
    - [ ] Access a "Dashboard" or "My Projects" sidebar.
- [ ] **Mockup State**:
    - [ ] Save full transformation state (zoom, rotation, position, device type, colors).
    - [ ] Support multiple mockups within a single project (optional/advanced).

## Notes
- Users should not lose work when they decide to sign up halfway through. Use local storage to "hold" the current mockup until they log in.
- The UI should clearly distinguish between "Project Settings" and "Mockup Settings".

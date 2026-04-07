### System Patterns: Vanilla Web Application

**Architecture Overview:**
This project will follow a simple, client-side architecture. It's a single-page application (SPA) in its most basic form, where all logic resides within the user's browser. The application will be composed of three distinct files: `index.html` for structure, `style.css` for presentation, and `script.js` for behavior.

**Key Technical Decisions:**
*   **Vanilla JavaScript:** All interactive elements and DOM manipulation will be handled using pure JavaScript (ES6+), avoiding external libraries or frameworks for simplicity and learning purposes.
*   **Event Delegation:** For handling actions on dynamically added todo items (like marking complete or deleting), event listeners will be attached to a parent container to improve performance and simplify code.
*   **Separation of Concerns:** HTML will define the content, CSS will handle visual styling, and JavaScript will manage all application logic and user interactions.

**Design Patterns (Implicit):**
*   **Module Pattern (Basic):** JavaScript functions will be organized to encapsulate related logic, though not strictly adhering to a formal module system.
*   **DOM Manipulation:** Direct manipulation of the Document Object Model using standard browser APIs.
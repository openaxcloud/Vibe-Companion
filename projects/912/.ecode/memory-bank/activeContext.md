### Active Context: Initial Setup and Core Features

**Current Focus:**
The immediate focus is on establishing the foundational structure and implementing the primary interactive features of the Todo app. This includes setting up the basic HTML layout, linking the CSS, and writing the initial JavaScript functions for task management.

**Next Steps (Checklist):**
*   [ ] **Create `index.html`:** Set up the basic HTML boilerplate, including a title, a heading, an input field for new todos, an 'Add' button, and an unordered list (`<ul>`) to display todos.
*   [ ] **Create `style.css`:** Link this file to `index.html` and add initial styles for basic layout, input field, buttons, and list items.
*   [ ] **Create `script.js`:** Link this file to `index.html` (preferably at the end of `<body>`).
*   [ ] **Implement 'Add Todo' functionality in `script.js`:**
    *   Get references to the input field, 'Add' button, and todo list.
    *   Add an event listener to the 'Add' button.
    *   When clicked, get the value from the input, create a new `<li>` element, add it to the `<ul>`, and clear the input.
*   [ ] **Implement 'Mark Complete' functionality:**
    *   Modify the `<li>` creation to include a checkbox or allow clicking the list item itself.
    *   Add an event listener (using event delegation on the `<ul>`) to toggle a 'completed' CSS class on the `<li>` element.
*   [ ] **Implement 'Delete Todo' functionality:**
    *   Modify the `<li>` creation to include a 'Delete' button.
    *   Add an event listener (using event delegation on the `<ul>`) to remove the parent `<li>` element when its 'Delete' button is clicked.
*   [ ] **Refine basic CSS styling:** Add styles for completed tasks (e.g., strikethrough, lighter color) and button hover states.
# Understanding React Hooks
Date: 2024-01-15
Description: A deep dive into the most essential React Hooks and how to use them effectively.

React Hooks revolutionized the way we write functional components by allowing us to use state and other React features without writing a class. Let's explore some of the fundamental hooks.

## useState

The `useState` hook allows you to add state to functional components. It returns a pair: the current state value and a function that lets you update it.

```typescript
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

## useEffect

The `useEffect` hook lets you perform side effects in functional components. This is a perfect place for data fetching, subscriptions, or manually changing the DOM.

```typescript
import React, { useState, useEffect } from 'react';

function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prevSeconds => prevSeconds + 1);
    }, 1000);

    // Cleanup function
    return () => clearInterval(interval);
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  return <p>Timer: {seconds} seconds</p>;
}
```

The dependency array is crucial for controlling when the effect re-runs. An empty array `[]` means it runs once. Omitting it means it runs after every render.

## useContext

`useContext` provides a way to pass data through the component tree without having to pass props down manually at every level.

```typescript
import React, { useContext, createContext } from 'react';

// 1. Create a Context
const ThemeContext = createContext('light');

function App() {
  return (
    // 2. Provide the Context value
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
  );
}

function Toolbar() {
  return (
    <div>
      <ThemedButton />
    </div>
  );
}

function ThemedButton() {
  // 3. Consume the Context value
  const theme = useContext(ThemeContext);
  return <button className={theme}>I am a {theme} button</button>;
}
```

Hooks make functional components more powerful and easier to manage, allowing for cleaner code and better separation of concerns.

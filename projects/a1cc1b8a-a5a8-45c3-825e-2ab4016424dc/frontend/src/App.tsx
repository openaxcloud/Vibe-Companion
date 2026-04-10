// filename: frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'wouter';

const App: React.FC = () => {
    return (
        <Router>
            <Switch>
                <Route path="/" component={HomePage} />
                {/* Add additional routes here */}
            </Switch>
        </Router>
    );
};

const HomePage: React.FC = () => {
    return <div className="container mx-auto p-4">Welcome to the AI Chatbot</div>;
};

export default App;
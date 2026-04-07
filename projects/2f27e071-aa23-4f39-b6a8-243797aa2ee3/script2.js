const { useState } = React;

function App() {
    return (
        <div>
            <h1>Hello, World!</h1>
        </div>
    );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
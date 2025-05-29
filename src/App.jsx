import Chores from './components/Chores';
import '@picocss/pico';

const instructions = `
    This is a list of chores that need to be done.
    If you see something that needs to be done, please do it.
    If you see something that has been done, please mark it as done.
    Reminders for chores will continuously be sent out until they are marked as done.
`;

function App() {
    return (
        <>
            <header>
                <h1>Chores</h1>
            </header>
            <main class="container-fluid">
                <pre class="instructions">{instructions}</pre>
                <Chores />
            </main>
            <footer>
                <p>© {new Date().getFullYear()} Chores</p>
            </footer>
        </>
    )
}

export default App

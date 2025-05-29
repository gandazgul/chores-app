import Chores from './components/Chores';
import '@picocss/pico';

const instructions = `
    This is a list of chores that need to be done.
    If you see something that needs to be done, please do it.
    If you see something that has been done, please mark it as done.
    Reminders for chores will continuously be sent out until they are marked as done.
    
    TODO:
    * Add a way to set a due date for chores, due dates can be fuzzy like an entire month or a specific day and time.
    * Due dates can be set to repeat every day, week, month, or year. Also want to be able to set repeat fuzzy dates like twice a week without specifying which days.
    * Add a way to set a priority for chores
    * Add a way to assign chores to people
    * Implement notifications for chores
    * view my chores is the default view, but you can view all chores
    * Sort chores by due date then priority
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

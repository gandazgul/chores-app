import PropTypes from "prop-types";

function AddTaskModal(props) {
    PropTypes.checkPropTypes(AddTaskModal.propTypes, props, 'prop', 'AddTaskModal');
    const { open = () => false, onClose, onAddNewTask } = props;

    function handleAddNewTask() {
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const priority = document.getElementById('task-priority').value;
        const schedule = document.getElementById('task-schedule').value;

        onAddNewTask({
            title,
            description,
            priority,
            schedule,
        });
    }

    return (
        <dialog open={open()}>
            <article>
                <header>
                    <button aria-label="Close" rel="prev" onClick={onClose}></button>
                    <p>
                        <strong>🗓️ New Task</strong>
                    </p>
                </header>
                <form onSubmit={(e) => e.preventDefault()}>
                    <label htmlFor="task-title">Title</label>
                    <input type="text" id="task-title" name="task-title" />
                    <label htmlFor="task-description">Description</label>
                    <textarea id="task-description" name="task-description" />
                    <label htmlFor="task-priority">Priority</label>
                    <select id="task-priority" name="task-priority">
                        <option value="1">Low</option>
                        <option value="2">Medium</option>
                        <option value="3">High</option>
                    </select>
                    <label htmlFor="task-schedule">Schedule</label>
                    <input type="datetime-local" id="task-schedule" name="task-schedule" />
                    <button type="submit" onClick={handleAddNewTask}>Add Task</button>
                </form>
            </article>
        </dialog>
    );
}

AddTaskModal.propTypes = {
    open: PropTypes.func,
    onClose: PropTypes.func.isRequired,
    onAddNewTask: PropTypes.func.isRequired,
};

export default AddTaskModal;

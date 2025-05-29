import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from 'solid-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

// Add the plus icon to the library
library.add(faPlus);

// Styles are expected to be in App.less or a dedicated file imported elsewhere.

function AddChoreFloatButton({ onClick }) {
  return (
    <div className="add-chore-button-container">
      <button onClick={onClick} aria-label="Add new chore">
        <FontAwesomeIcon icon={faPlus} />
      </button>
    </div>
  );
}

export default AddChoreFloatButton;

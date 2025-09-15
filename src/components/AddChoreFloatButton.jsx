import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

library.add(faPlus);

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

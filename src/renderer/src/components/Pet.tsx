import Live2DPet from './Live2DPet';
import './Pet.css';

interface PetProps {
    stateMachine: any;
    skinFolder?: string;
    onSizeChange?: (width: number, height: number) => void;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

function Pet({ skinFolder = "cubism-Hiyori", onSizeChange, onClick, onDoubleClick }: PetProps): JSX.Element {
    return (
        <div className="pet-wrapper">
            <Live2DPet skinFolder={skinFolder} onSizeChange={onSizeChange} onClick={onClick} onDoubleClick={onDoubleClick} />
        </div>
    );
}

export default Pet;

import Live2DPet, { PetSizeChangePayload, PetVisualBounds } from './Live2DPet';
import './Pet.css';

interface PetProps {
    stateMachine: any;
    skinFolder?: string;
    layoutVersion?: number;
    onSizeChange?: (payload: PetSizeChangePayload) => void;
    onPetBoundsChange?: (bounds: PetVisualBounds | null) => void;
    onInteract?: (info: { reaction: string; bubbleText: string }) => void;
    onDoubleClick?: () => void;
}

function Pet({
    skinFolder = "cubism-Hiyori",
    layoutVersion,
    onSizeChange,
    onPetBoundsChange,
    onInteract,
    onDoubleClick,
}: PetProps): JSX.Element {
    return (
        <div className="pet-wrapper">
            <Live2DPet
                skinFolder={skinFolder}
                layoutVersion={layoutVersion}
                onSizeChange={onSizeChange}
                onPetBoundsChange={onPetBoundsChange}
                onInteract={onInteract}
                onDoubleClick={onDoubleClick}
            />
        </div>
    );
}

export default Pet;

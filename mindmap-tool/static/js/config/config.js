// Node dimensions
export const NODE_WIDTH = 100;
export const NODE_HEIGHT = 30;

// Spacing configuration
export const BASE_VERTICAL_SPACING = 100;
export const BASE_HORIZONTAL_SPACING = 200;
export const MIN_NODE_SEPARATION = NODE_WIDTH * 1.2;  // Minimum space between sibling nodes
export const MIN_SUBTREE_SEPARATION = NODE_WIDTH * 1.5;  // Minimum space between different subtrees

// Zoom configuration
export const ZOOM_SETTINGS = {
    MIN_SCALE: 0.1,
    MAX_SCALE: 3
};

// Animation timings (in milliseconds)
export const ANIMATION = {
    NODE_MOVEMENT: 500,
    PATH_GROWTH: 1000,
    TRANSITION_DELAY: 500
}; 
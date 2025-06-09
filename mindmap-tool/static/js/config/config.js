// Node dimensions
export const NODE_WIDTH = 180; // Default width, can be overridden by node type
export const NODE_HEIGHT = 40;  // Default height, can be overridden

// Layout configuration
export const LAYOUT = {

    // --- Initial Positioning & Global Spacing ---
    INITIAL_X_OFFSET: 50,        // Horizontal starting position (X-coordinate) for the main 'title node' on the canvas.
    INITIAL_Y_OFFSET: 50,        // Vertical starting position (Y-coordinate) for the main 'title node' on the canvas.

    CONTENT_TOP_MARGIN: 10,      // Vertical space between the bottom of a 'parent node' (header node or title node) 
                                 // and the top of the first 'child node' (sub-header node) or 'text node' (content node) beneath it.
                                 // Also used if a 'parent node' has both 'text nodes' and 'sub-header nodes' for the initial gap.

    // --- Header & Sub-header Node Layout ---
    HEADER_VERTICAL_SPACING: 30, // Vertical spacing between sibling 'header nodes' or sibling 'sub-header nodes' 
                                 // when they are listed one below the other, branching from the same vertical line/path.

    HEADER_HORIZONTAL_OFFSET: 30, // Horizontal distance from the 'title node's' vertical connection line (at titleNode.x + VERTICAL_TRUNK_NODE_OFFSET)
                                  // to the left edge of a first-level 'header node'.

    SUB_HEADER_HORIZONTAL_OFFSET: 15, // Horizontal distance from a 'sub-header node's' dedicated vertical connection line
                                      // (either the parent's main line or a special bus line) to the left edge of the 'sub-header node' itself.
                                      // This makes sub-headers sit close to their feeder line.

    // --- Text Node (Content Node) Layout ---
    CONTENT_INDENTATION: 20,     // Horizontal distance from the 'parent node's' (header node) common connection line exit point
                                 // to the left edge of a 'text node' (content node) below it.
                                 // This creates the L-bend space for the text node's connector.

    CONTENT_VERTICAL_SPACING: 10, // Vertical spacing between consecutive 'text nodes' (content nodes) 
                                 // when multiple text blocks are under the same 'parent node' (header node).

    CONTENT_TEXT_PADDING: 10,     // Internal padding (top, left, right, bottom - though mainly used for top/left for text alignment)
                                 // within a 'text node' (content node) for its text.
                                 // Affects where the connection line attaches on the text node's left side.

    // --- Common Settings for Node Lines & Sizing ---
    VERTICAL_TRUNK_NODE_OFFSET: 5, // Horizontal offset from a 'parent node's' (title node or header node) absolute left edge (node.x)
                                  // to the point where connection lines to its children visually start.
                                  // e.g., if 0, lines start from node.x; if 5, lines start from node.x + 5.

    MIN_NODE_WIDTH: 100,         // Minimum width for any node ('title node', 'header node', 'text node') to prevent them from becoming too narrow.

    TEXT_PADDING_HORIZONTAL: 10, // Horizontal padding added on both sides of the measured text when calculating the width
                                 // for 'title nodes' and 'header nodes' (which have dynamically adjusting widths).

    TEXT_PADDING_VERTICAL: 10,    // Vertical padding added above and below the measured text when calculating dynamic height
                                 // (primarily used in height estimation for multi-line 'text nodes').

    LINE_HEIGHT_EM: 1.5,         // Line height (as a multiple of font size, e.g., 1.5em for 30px line height on 20px font)
                                 // used for spacing lines of wrapped text within 'text nodes' (content nodes) and for estimating their total height.

    // --- Special Path for Sub-headers (when parent header also has text nodes) ---
    SUB_HEADER_BUS_HEIGHT: 20,   // Additional vertical space reserved below a 'parent node' (header node) and *above* its 'text nodes' (content nodes)
                                 // to draw the horizontal "bus" line that feeds its 'sub-header nodes'.

    SUB_HEADER_BUS_RIGHT_MARGIN: 10, // Horizontal spacing added to the right of the 'text node' (content node) area
                                     // before the vertical part of the "bus" line (which feeds 'sub-header nodes') turns downwards.
                                     // Ensures the sub-header branching path visually clears the content.

    CONTENT_MAX_HEIGHT_MULTIPLIER: 3, // Content height should not exceed parent height * this value
    CONTENT_WIDTH_INCREMENT: 50,      // How much to increase width each iteration when optimizing
    CONTENT_MAX_WIDTH_MULTIPLIER: 4,  // Maximum width as multiple of default NODE_WIDTH
};

// Zoom configuration
export const ZOOM_SETTINGS = {
    MIN_SCALE: 0.1,
    MAX_SCALE: 3,
    INITIAL_SCALE: 1.0, // Start at 100% zoom
    // The actual translate values will be set in mindmap.js to position the view
    // These can serve as defaults if needed, but dynamic calculation is better.
    INITIAL_TRANSLATE_X: LAYOUT.INITIAL_X_OFFSET, 
    INITIAL_TRANSLATE_Y: LAYOUT.INITIAL_Y_OFFSET  
};

// Animation timings (in milliseconds)
export const ANIMATION = {
    ENABLED: true,
    NODE_FADE_IN: 700,      // Duration for node to fade in (ms)
    PATH_GROWTH: 700,       // Old fixed duration, can be removed or kept as max_duration
    SPEED_PPS: 250,         // New: Speed in Pixels Per Second for path growth (e.g., 250 for slower)
    MAX_PATH_DURATION: 1500,// New: Optional - A maximum duration for very long paths (ms) - maybe increase if speed is slower
    MIN_PATH_DURATION: 300, // New: Optional - A minimum duration for very short paths (ms) - maybe increase
    TRANSITION_DELAY: 50    // Old delay between sequential animations, will be removed from mindmap.js loop
};

// New settings for image nodes
export const IMAGE_SETTINGS = {
    // IMPORTANT: You need to configure your web server to serve the image directory.
    // For example, if your images are in 'backend/processing/marker_output/ZPO_temp',
    // you might serve this directory at the '/images/ZPO_temp' URL path.
    BASE_URL: '/images/ZPO_temp',
    MAX_WIDTH: 350,
    MAX_HEIGHT: 300,
    ERROR_NODE_WIDTH: 180,
    ERROR_NODE_HEIGHT: 40,
};

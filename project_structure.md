### File Structure

mindmap-tool
 ┣ src
 ┃ ┣ __pycache__
 ┃ ┃ ┣ __init__.cpython-312.pyc
 ┃ ┃ ┗ main.cpython-312.pyc
 ┃ ┣ database
 ┃ ┃ ┣ __pycache__
 ┃ ┃ ┃ ┗ database.cpython-312.pyc
 ┃ ┃ ┗ database.py
 ┃ ┣ llm
 ┃ ┃ ┣ __init__.py
 ┃ ┃ ┗ functions.py
 ┃ ┣ mindmap
 ┃ ┃ ┣ __pycache__
 ┃ ┃ ┃ ┣ __init__.cpython-312.pyc
 ┃ ┃ ┃ ┣ models.cpython-312.pyc
 ┃ ┃ ┃ ┗ operations.cpython-312.pyc
 ┃ ┃ ┣ __init__.py
 ┃ ┃ ┣ models.py
 ┃ ┃ ┗ operations.py
 ┃ ┣ utils
 ┃ ┃ ┣ __init__.py
 ┃ ┃ ┗ config.py
 ┃ ┣ __init__.py
 ┃ ┗ main.py
 ┣ static
 ┃ ┣ css
 ┃ ┃ ┗ styles.css
 ┃ ┣ js
 ┃ ┃ ┣ components
 ┃ ┃ ┃ ┣ Animation.js
 ┃ ┃ ┃ ┗ Node.js
 ┃ ┃ ┣ config
 ┃ ┃ ┃ ┣ config.js
 ┃ ┃ ┃ ┗ state.js
 ┃ ┃ ┣ customization
 ┃ ┃ ┃ ┗ ColorManager.js
 ┃ ┃ ┣ examples
 ┃ ┃ ┃ ┣ MindmapBuilder.js
 ┃ ┃ ┃ ┣ sample_input.json
 ┃ ┃ ┃ ┣ structureDefinitions.js
 ┃ ┃ ┃ ┣ structures.js
 ┃ ┃ ┃ ┗ tableOfContents.json
 ┃ ┃ ┣ layout
 ┃ ┃ ┃ ┣ PathGenerator.js
 ┃ ┃ ┃ ┗ TreeLayout.js
 ┃ ┃ ┣ models
 ┃ ┃ ┃ ┗ TreeNode.js
 ┃ ┃ ┣ network
 ┃ ┃ ┃ ┣ ApiClient.js
 ┃ ┃ ┃ ┗ WebSocket.js
 ┃ ┃ ┣ utils
 ┃ ┃ ┃ ┗ EventHandlers.js
 ┃ ┃ ┗ mindmap.js
 ┃ ┗ index.html
 ┣ templates
 ┃ ┗ index.html
 ┣ testing
 ┃ ┣ sample_input.json
 ┃ ┗ test_layout.py
 ┣ .gitignore
 ┗ mindmap-tool

### File Descriptions

#### `src/main.py`
- **Purpose**: Main FastAPI application entry point for the backend.
- **Key Functionalities**:
    - Initializes the FastAPI app.
    - Serves static files from the `static` directory (CSS, JS, images).
    - Serves `static/index.html` as the root page.
    - Defines Pydantic models for request/response validation (e.g., `NodeBase`, `MindMapCreate`, `MindMapResponse`, `NodeResponse`).
    - Implements a `ConnectionManager` for handling WebSocket connections, allowing real-time communication for mindmap updates.
    - Sets up database table creation on startup using SQLAlchemy (`Base.metadata.create_all`).
    - Defines API Endpoints:
        - `/mindmaps/`: Create a new mindmap (POST), get a specific mindmap (GET).
        - `/mindmaps/{mindmap_id}/nodes`: Get all nodes for a mindmap (GET), create a new node (POST).
        - `/mindmaps/{mindmap_id}/nodes/{node_id}`: Delete a node (DELETE).
        - `/mindmaps/{mindmap_id}/root`: Create a root node for a mindmap (POST).
        - `/mindmaps/{mindmap_id}/nodes/{parent_id}/children`: Add multiple child nodes (POST).
        - `/mindmaps/{mindmap_id}/structure`: Get the hierarchical structure of a mindmap (GET).
        - `/mindmaps/{mindmap_id}/layout`: Save the positions of nodes in a mindmap (POST).
        - `/ws/{mindmap_id}`: WebSocket endpoint for real-time updates for a specific mindmap.
    - Uses functions from `src.mindmap.operations` for business logic and database interactions.
    - Broadcasts messages (e.g., `node_created`, `node_deleted`) to connected WebSocket clients.

#### `static/index.html`
- **Purpose**: The main HTML page for the mindmap user interface.
- **Key Features**:
    - Sets up the basic page structure with a title and viewport settings.
    - Includes `/static/css/styles.css` for styling.
    - Includes the D3.js library (`d3.v7.min.js`) for data visualization.
    - Defines a layout with a collapsible sidebar (`.sidebar`) and a main mindmap container (`#mindmap`).
    - **Sidebar Controls**:
        - Input and button to create a new mindmap.
        - Input and button to create a root node.
        - Input and button to add a child node.
        - Button to build an example structure (likely from a predefined JSON).
        - Displays for current mindmap ID and selected node ID.
        - **Color Customization Section**: Allows users to pick colors for background, grid dots (with opacity), connection paths (with opacity), node fill, node border, and text.
    - Includes `/static/js/mindmap.js` as a JavaScript module to handle the application logic.
    - Sidebar toggle button (`.sidebar-toggle`).

#### `static/js/mindmap.js`
- **Purpose**: Core JavaScript file for the frontend mindmap logic and rendering.
- **Key Functionalities**:
    - Manages the mindmap state, including current nodes, selected node, and current mindmap ID.
    - Initializes and manages the D3.js SVG canvas for drawing the mindmap.
    - Sets up zoom and pan functionality using `d3.zoom`.
    - Handles WebSocket connections for real-time updates using functions from `network/WebSocket.js`.
    - Interacts with the backend API using functions from `network/ApiClient.js` (e.g., `createMindmap`, `createRootNode`, `addChildNode`).
    - **Rendering Logic (`updateLayout`, `addNodeToLayout`)**:
        - Uses `TreeLayout.js` (to be reviewed) to calculate node positions.
        - Clears and redraws nodes and connections on the SVG canvas.
        - Implements animations for adding nodes and connections using functions from `components/Animation.js`.
        - Dynamically adjusts zoom and pan to fit the mindmap content.
        - Handles rendering of connector dots for nodes with multiple leaf children.
    - **Event Handling**:
        - Handles node click events for selection.
        - Handles window resize events to adjust the SVG canvas dimensions.
        - Manages sidebar toggle functionality and resizes the mindmap area accordingly.
    - **Node Management**:
        - `addNode()`: Adds a node by calling the API and then updating the layout.
        - `removeNode()`: Removes a node and updates the layout.
    - `buildSelectedStructure()`: Fetches `sample_input.json` and renders it.
    - Initializes color customization features from `customization/ColorManager.js`.
    - Exposes key functions (e.g., `createMindmap`, `createRootNode`, `addChildNode`, `buildSelectedStructure`) to the global `window` object for access from `index.html`.

#### `src/mindmap/operations.py`
- **Purpose**: Backend Python module responsible for the business logic and database operations related to mindmaps and nodes.
- **Key Functionalities**:
    - Uses SQLAlchemy for ORM and database interaction (with models from `.models`).
    - `create_mindmap(db, title)`: Creates a new mindmap entry in the database.
    - `create_root_node(db, mindmap_id, content)`: Creates the first (root) node for a mindmap.
    - `add_node(db, mindmap_id, content, parent_id, x_pos, y_pos)`: Adds a new node (root or child) to a mindmap.
    - `add_child_node(db, parent_id, content, x_pos, y_pos)`: Specifically adds a child node to an existing parent.
    - `add_multiple_children(db, parent_id, contents)`: Adds several child nodes to a parent.
    - `get_structure(db, mindmap_id, start_node_id)`: Retrieves the hierarchical tree structure of nodes, starting from a specified node or the root.
    - `find_node(db, mindmap_id, content)`: Finds a node by its content.
    - `edit_node_content(db, node_id, new_content)`: Updates the content of an existing node.
    - `delete_node(db, node_id)`: Deletes a node and its subtree (relies on database cascade).
    - `move_node(db, node_id, new_parent_id)`: Changes the parent of a node, effectively moving it within the tree.
    - `get_depth(db, node)`: Calculates the depth of a node in the tree.
    - `is_descendant(db, ancestor_id, descendant_id)`: Checks for ancestral relationships.
    - `save_layout(db, mindmap_id, node_positions)`: Updates the `x_pos` and `y_pos` of multiple nodes in the database.
    - Raises `HTTPException` for errors like "not found" or "bad request".

 #### `static/js/layout/TreeLayout.js`
- **Purpose**: Responsible for calculating the X and Y positions of nodes in the mindmap, arranging them in a hierarchical tree structure.
- **Core Class**: `TreeLayout`
    - **`constructor()`**: Initializes internal state, like `usedPositions` to track occupied layout spots.
    - **`buildTree(nodes)`**:
        - Takes a flat list of node data (typically from the backend or `mindmap.js`).
        - Converts this list into a hierarchical tree structure using `TreeNode` objects (from `../models/TreeNode.js`).
        - Identifies root nodes and parent-child relationships.
        - Determines if nodes are leaves (no children).
        - Returns a `Map` of node IDs to their `TreeNode` instances.
    - **`calculateLayout(root, nodesMap)`**: This is the primary method used by `mindmap.js` to arrange nodes.
        - Takes the root `TreeNode` and the `nodesMap` (from `buildTree`).
        - Assigns a `level` (depth) to each node in the tree.
        - Recursively calculates X and Y coordinates for each node.
            - Y position is primarily determined by the node's level.
            - X position logic aims to distribute nodes horizontally.
        - **Leaf Stacking Logic**:
            - If a parent node has a significant number of children, and many of them are leaf nodes (thresholds defined in `config.js`), it implements a special stacking strategy.
            - A "fake node" (acting as a connector dot) is introduced as a child of the parent.
            - The actual leaf nodes then become children of this "fake node" and are arranged vertically beneath it, offset horizontally. This helps to condense wide branches with many leaves.
            - Non-leaf children of the original parent are typically placed horizontally, to the side of the stacked leaf group.
        - **Standard Layout**: For branches not meeting stacking criteria, it attempts to center parent nodes above their direct children.
        - It appears to use node label width (by temporarily rendering text via `mindMapState.getGroup()`) to influence horizontal spacing for non-stacked nodes.
        - Returns a flat list of all `TreeNode` objects (including any "fake nodes" and their leaf children) with their calculated `x`, `y`, `level`, and `isFake` properties.
- **Exported Helper Functions (potentially for alternative layout strategies or specific use cases)**:
    - **`calculateSubtreeDimensions(node)`**: Calculates the visual width and extent of a subtree.
    - **`calculateNewLayout(newNodeParentId, tempId, currentNodes, treeLayout)`**: An alternative function to calculate node positions.
        - It uses `d3.stratify()` to build a D3 hierarchy from a flat list of nodes.
        - Employs an `analyzeTreeStructure` helper to perform a multi-pass analysis of the tree's levels and parent-child groups to determine widths and stacking needs *before* positioning.
        - `calculateLeafPositions` is used for placing stacked leaves and their connector dot.
        - Returns a `Map` of node IDs to position objects (including `isDot`, `connectFromDot` flags).
- **Dependencies**:
    - `../models/TreeNode.js`: For the internal representation of nodes.
    - `../config/config.js`: For layout constants like node dimensions, spacing, and stacking thresholds.
    - `../config/state.js`: (Used in `calculateLayout` via `mindMapState` to get text dimensions for dynamic width calculation).
- **Key Features**:
    - Generates a classic hierarchical tree layout.
    - Implements an adaptive leaf node arrangement (vertical stacking with a connector dot) to manage wide trees and improve visual clarity.
    - Introduces "fake nodes" as a layout mechanism for these connector dots.

#### `static/js/models/TreeNode.js`
- **Purpose**: Defines the client-side data structure for representing a node within the mindmap's tree layout.
- **Class**: `TreeNode`
    - **Properties**:
        - `id`: Unique identifier of the node.
        - `label`: Text content of the node.
        - `parentId`: ID of the parent node.
        - `children`: An array to hold child `TreeNode` objects.
        - `x`, `y`: Calculated coordinates for the node's position.
        - `level`: Depth of the node in the tree.
        - `isLeaf`: Boolean, true if the node has no children.
        - `isRoot`: Boolean, true if the node has no parent.
        - `isFake`: Boolean, true if this is a "fake" node used for layout purposes (e.g., a connector dot point).
- **Class**: `NodeGroup` (seems to be a helper class, possibly for layout calculations, though its usage isn't immediately clear from `TreeLayout.js`'s primary `calculateLayout` method. It might be used by the alternative `calculateNewLayout` or related helpers).
    - **Properties**:
        - `parent`: The parent `TreeNode`.
        - `leaves`: Array of leaf children.
        - `nonLeaves`: Array of non-leaf children.
        - `dimensions`: Object storing width, height, and starting X position for the group.
        - `hasConnectorDot`: Boolean indicating if the group uses a connector dot.
        - `dotPosition`: Coordinates for the connector dot.
    - **Methods**:
        - `totalChildren`: Getter for total number of children.
        - `shouldUseConnectorDot()`: Determines if a connector dot is needed (if there are 2 or more leaves).
        - `addNode(node)`: Adds a node to either the `leaves` or `nonLeaves` array.

#### `static/js/components/Node.js`
- **Purpose**: Handles the creation and rendering of visual elements for mindmap nodes and their connections on the SVG canvas using D3.js.
- **Key Functions**:
    - **`createNodeGroup(nodeData, handleNodeClick)`**:
        - Takes node data (including `id`, `label`, `x`, `y`, `isLeaf`) and a click handler.
        - Appends a D3 group (`<g class="node">`) to the main SVG group (from `mindMapState`).
        - Calculates the node's width dynamically based on its label length, ensuring a minimum width (from `config.NODE_WIDTH`).
        - Renders a `<rect>` element for the node body with rounded corners. Styles it differently based on whether it's a `leaf-node` or `parent-node`.
        - Renders `<text>` for the node's label, centered within the rectangle.
        - Applies a fade-in animation for the new node.
        - Attaches the click handler and stores `nodeData` with the D3 element.
    - **`createConnectorDot(dotData)`**:
        - Takes dot data (including `x`, `y`, `parentId`).
        - Renders a `<circle class="connector-dot">` element on the SVG canvas.
        - Uses radius and styling from `config.CONNECTOR_DOT`.
    - **`createConnection(sourcePos, targetPos, targetId, isLeafConnection)`**:
        - Takes source and target positions, the target node's ID, and a flag indicating if it's connecting to a leaf (part of a stacked group).
        - Uses `generateOrthogonalPath` (from `../layout/PathGenerator.js`) to get the SVG path string for drawing a line between the source and target.
        - Inserts a `<path class="link">` element into the SVG canvas (before actual nodes, so lines are underneath).
        - Applies a specific class (`leaf-link`) if it's a connection related to stacked leaves.
- **Dependencies**:
    - `../config/config.js`: For node dimensions, connector dot styles.
    - `../config/state.js`: To get the main D3 SVG group (`mindMapState.getGroup()`).
    - `../layout/PathGenerator.js`: For generating the path strings for connections.

#### `static/js/components/Animation.js`
- **Purpose**: Manages animations for adding nodes and drawing connection lines.
- **Key Functions**:
    - **`addNodeWithAnimation(nodeData, handleNodeClick)`**:
        - Orchestrates the animated addition of a node.
        - If the node has a parent (`nodeData.parentId`), it first determines the source position (either the actual parent or a connector dot, based on `nodeData.connectToDot`, `nodeData.dotX`, `nodeData.dotY`, `nodeData.parentX`, `nodeData.parentY`).
        - Calls `createConnection` (from `./Node.js`) to create the SVG path element.
        - Calls `animateConnection` to animate the drawing of this path.
        - **Crucially, it waits (using `await new Promise`) for the path animation to complete *before* calling `createNodeGroup` (from `./Node.js`) to render the node itself.** This ensures lines are drawn first, then the node appears.
    - **`animateConnection(link, onComplete)`**:
        - Takes a D3 selection of an SVG path element (`link`) and an optional completion callback.
        - Animates the path drawing using the stroke-dasharray and stroke-dashoffset SVG attributes to create a "growing line" effect.
        - The animation duration comes from `config.ANIMATION.PATH_GROWTH`.
        - Removes dash attributes and calls `onComplete` when the animation finishes.
- **Dependencies**:
    - `../config/config.js`: For animation timings.
    - `../config/state.js`: To get the main D3 SVG group.
    - `./Node.js`: For `createNodeGroup` and `createConnection`.
    - `../layout/PathGenerator.js`: (Implicitly, as `createConnection` uses it).

#### `static/js/config/config.js`
- **Purpose**: Centralized configuration file for various constants used throughout the frontend JavaScript application.
- **Key Constants Defined**:
    - **`NODE_WIDTH`, `NODE_HEIGHT`**: Default dimensions for mindmap nodes.
    - **`LAYOUT`**: Object containing:
        - `NODE_SPACING`: Horizontal space between sibling nodes.
        - `VERTICAL_SPACING`: Vertical space between levels.
        - `LEAF_STACK_SPACING`: Vertical space between vertically stacked leaf nodes.
        - `STACK_THRESHOLD`: Object with `TOTAL_NODES` and `LEAF_NODES` defining when to trigger the leaf stacking layout.
    - **`ZOOM_SETTINGS`**: `MIN_SCALE` and `MAX_SCALE` for zoom functionality.
    - **`ANIMATION`**: Object containing:
        - `PATH_GROWTH`: Duration for the connection line drawing animation.
        - `TRANSITION_DELAY`: Delay used between appearances of sequentially added nodes (seen in `mindmap.js`).
    - **`LEAF_VERTICAL_SPACING`**: (Appears duplicative of `LAYOUT.LEAF_STACK_SPACING` or slightly different, context needed).
    - **`MIN_LEAF_PARENT_SPACING`**: Minimum space between a parent and the start of its leaf group.
    - **`CONNECTOR_DOT`**: Object for connector dot appearance:
        - `RADIUS`: Radius of the dot.
        - `OFFSET_X`, `OFFSET_Y`: Default offset from the parent node for the dot.
    - **`LEAF_NODE`**: Object for stacked leaf node layout:
        - `VERTICAL_SPACING`: Vertical space between individual leaf nodes in a stack. (Potentially overlaps with `LAYOUT.LEAF_STACK_SPACING`).
        - `HORIZONTAL_OFFSET`: How far left from the parent (or dot) the stacked leaves should be.
        - `MIN_COUNT_FOR_DOT`: Minimum number of leaf children for a parent to use a connector dot.

#### `static/js/config/state.js`
- **Purpose**: Provides a centralized store for managing the global state of the mindmap frontend application.
- **Class**: `MindMapState`
    - **Properties**:
        - `svg`: Reference to the main D3 SVG element.
        - `g`: Reference to the primary D3 group element within the SVG (used for zoom/pan and drawing).
        - `currentMindmapId`: ID of the currently active mindmap.
        - `selectedNodeId`: ID of the currently selected node.
        - `ws`: Reference to the WebSocket connection object.
        - `width`, `height`: Dimensions of the mindmap container.
        - `currentTransform`: The current D3 zoom transform object.
        - `zoom`: The D3 zoom behavior object.
    - **Methods**:
        - Provides getter and setter methods for all its properties (e.g., `getSvg()`, `setSvg(svg)`).
        - `getDimensions()`: Returns an object `{ width, height }`.
        - `clear()`: Resets parts of the state (currently only `selectedNodeId`).
- **Singleton Instance**:
    - `export const mindMapState = new MindMapState();`
    - This ensures that all modules importing `mindMapState` share the same instance and thus the same application state.

#### `static/js/layout/PathGenerator.js`
- **Purpose**: Generates SVG path data for drawing connection lines between nodes.
- **Key Function**:
    - **`generateOrthogonalPath(source, target, isLeafConnection)`**:
        - Takes source `{x, y}`, target `{x, y}` coordinates, and a boolean `isLeafConnection`.
        - **If `isLeafConnection` is true**: Generates a simple L-shaped path (vertical line from source, then horizontal line to target). This is typically used for connections from a connector dot to its stacked leaf nodes.
        - **If nodes are vertically aligned** (source.x and target.x are very close): Generates a straight vertical line.
        - **Otherwise (standard orthogonal path)**: Generates a path that goes vertically from the source to a Y-midpoint, then horizontally to the target's X-coordinate, and finally vertically to the target's Y-coordinate.
        - Returns an object: `{ path: "M ... V ... H ... V ...", length: <calculated_length_of_path> }`. The `length` is used by `Animation.js` for the line drawing effect.

#### `static/js/network/ApiClient.js`
- **Purpose**: Handles HTTP requests from the frontend to the backend FastAPI server.
- **Key Functions**:
    - **`createMindmap(title)`**:
        - Sends a POST request to `/mindmaps/` with the mindmap title.
        - On success, updates `mindMapState` with the new mindmap ID, updates UI text, clears the current SVG content, and calls `connectWebSocket`.
    - **`createRootNode(content)`**:
        - Sends a POST request to `/mindmaps/{mindmapId}/root` with the root node's content.
        - On success, clears the SVG, uses `TreeLayout` to calculate the position for the single root node, and renders it using `createNodeGroup`.
    - **`addChildNode(parentId, content)`**:
        - Sends a POST request to `/mindmaps/{mindmapId}/nodes` with content and `parent_id`.
        - Returns a promise that resolves to the new node's data (`{ id, label, parent_id }`). This data is then used by `mindmap.js` to update the layout.
    - **`loadMindmapStructure(mindmapId)`**:
        - Sends a GET request to `/mindmaps/{mindmapId}/structure`.
        - Flattens the received hierarchical JSON structure into a list of nodes.
        - Uses `TreeLayout` to calculate positions for all nodes.
        - Iteratively renders each node and its connection using `addNodeWithAnimation` (from `components/Animation.js`), creating a sequential build-up effect.
- **Dependencies**: `mindMapState`, `components/Node.js` (for `createNodeGroup`), `utils/EventHandlers.js` (for `handleNodeClick`), `network/WebSocket.js` (for `connectWebSocket`), `layout/TreeLayout.js`, `components/Animation.js` (for `addNodeWithAnimation`), `config/config.js`.

#### `static/js/network/WebSocket.js`
- **Purpose**: Manages the client-side WebSocket connection for real-time updates.
- **Key Functions**:
    - **`connectWebSocket(mindmapId)`**:
        - Establishes a WebSocket connection to `ws://{hostname}:{port}/ws/{mindmapId}`.
        - Assigns handlers for `onopen`, `onmessage`, `onerror`, and `onclose` events.
        - Stores the WebSocket object in `mindMapState`.
        - Closes any existing WebSocket connection before creating a new one.
        - Initializes a message queue and processing state in `mindMapState` (though these seem not fully utilized in the current message handling).
    - **`handleWebSocketMessage(data)`**: (Async function called on `ws.onmessage`)
        - **If `data.type === 'node_created'`**:
            - Retrieves the current nodes from the D3 data on SVG elements.
            - Adds the new node data to this local list.
            - Recalculates the entire layout using `TreeLayout`.
            - Clears the SVG and redraws all nodes (including the new one) sequentially with animations using `addNodeWithAnimation`.
        - **If `data.type === 'node_deleted'`**:
            - Removes the specified node's group (`<g>`) and its associated link (`<path>`) from the SVG.
            - Recalculates the layout for the remaining nodes (though it doesn't explicitly redraw or re-animate them after this recalculation, which might be an area for review).
- **Dependencies**: `mindMapState`, `components/Animation.js` (for `addNodeWithAnimation`), `utils/EventHandlers.js` (for `handleNodeClick`), `layout/TreeLayout.js`.

#### `static/js/utils/EventHandlers.js`
- **Purpose**: Provides utility functions for handling common user interface events.
- **Key Functions**:
    - **`handleNodeClick(event, d)`**:
        - Attached as a click listener to node groups.
        - Stops event propagation to prevent the SVG click handler from clearing selection.
        - Visually deselects any previously selected node and selects the clicked node (by adding/removing a 'selected' class and changing stroke color).
        - Updates `mindMapState.selectedNodeId` and `mindMapState.selectedNodeLabel`.
        - Updates the "Selected Node" text display in the UI.
    - **`clearSelection()`**:
        - Typically called when the SVG background is clicked.
        - Deselects any selected node visually.
        - Clears `mindMapState.selectedNodeId` and `mindMapState.selectedNodeLabel`.
        - Updates the "Selected Node" text display to "None".
    - **`handleResize()`**:
        - Attached as a listener to the window's resize event.
        - Gets the new dimensions of the `#mindmap` container.
        - Updates `mindMapState` with the new width and height.
        - Resizes the main SVG element to fit the container.
- **Dependencies**: `mindMapState`.

#### `static/js/customization/ColorManager.js`
- **Purpose**: Manages the application of color customizations selected by the user through the sidebar controls.
- **Key Function**:
    - **`initColorCustomization()`**:
        - Retrieves DOM elements for color pickers and opacity sliders from `index.html`.
        - **`updateBackground()`**: Modifies the fill color of the SVG pattern's background rectangle and the fill color/opacity of the grid dots within the pattern.
        - **`updatePaths()`**: Modifies the `stroke` color and `opacity` of all SVG paths with the class `.link`.
        - **`updateNodes()`**: Modifies the `fill` and `stroke` of all node rectangles (`.node rect`) and the `fill` of node text (`.node text`).
        - Adds `input` event listeners to all relevant controls, triggering the respective update functions when a control's value changes.
- **Dependencies**: `mindMapState` (to get the main SVG element for applying changes).

#### `static/css/styles.css`
- **Purpose**: Provides all the visual styling for the mindmap application.
- **Key Features**:
    - Imports 'Fira Code' Google Font.
    - **General Body/Layout**:
        - Sets a dark theme base (`background-color: #0A0A0A`, `color: #FFFFFF`).
        - Uses flexbox for the main layout (`.container`) to position the sidebar and mindmap area.
    - **Sidebar (`.sidebar`)**:
        - Styled with a semi-transparent dark background (`rgba(44, 44, 44, 0.97)`) and a backdrop filter for a blurred glass effect.
        - Implements a collapsible/expandable behavior (`.sidebar.collapsed`) with CSS transitions for smooth animation.
        - Styles the toggle button (`.sidebar-toggle`) including its rotation when collapsed.
    - **Controls within Sidebar**:
        - Styles for input fields (`.controls input`) and buttons (`.controls button`) with a consistent dark theme and hover effects.
        - Styles for information display areas (`#currentMindmap`, `#selectedNode`).
    - **Mindmap Container (`.mindmap-container`)**:
        - Takes up the remaining space, with a dark background.
    - **SVG Node Styling (`.node rect`, `.node text`)**:
        - Default fill, stroke, and rounded corners for node rectangles.
        - Drop shadow for a subtle depth effect.
        - Font styling for node text.
        - Hover effects (`.node:hover rect`) to highlight nodes.
        - Specific styling for selected nodes (`.node.selected rect`) with a different stroke color and more prominent shadow.
        - Styling for leaf nodes (`.node[data-is-leaf="true"] rect`) and their hover states.
        - Styling for parent nodes that have a connector dot (`.node[data-has-dot="true"]:hover rect`).
    - **SVG Link Styling (`.link`)**:
        - Default stroke color and width for connection lines.
        - Specific styling for links connected to leaf nodes (`.leaf-link`) and connector dots (`.connector-link`).
    - **Connector Dot Styling (`.connector-dot`)**:
        - Fill, stroke, and drop shadow for the small dots.
    - **Color Customization Section (`.color-customization`)**:
        - Styles for the container, header, labels, and input elements (color pickers, range sliders) within the color customization panel.
    - **Animation Classes** (e.g., `.node-entering`, `.node-entered`, `.connection-entering`, `.connection-entered`):
        - Defines opacity, transform (scale), and stroke-dashoffset properties for enter/exit animations, likely used in conjunction with D3 transitions or CSS transition groups.
    - **Zoom Controls (`.zoom-controls`, `.zoom-button`)**:
        - Styles for a floating panel containing zoom buttons.
    - **State-specific Node Styling**:
        - `.node.loading rect`: Applies a pulsing animation.
        - `.node.error rect`: Applies a shaking animation and error stroke color.
    - Uses `pointer-events: none;` on links, connector dots, and node text to ensure clicks pass through to the underlying node group or SVG for proper event handling.

#### `src/mindmap/models.py`
- **Purpose**: Defines the SQLAlchemy ORM models for the database, representing the structure of mindmaps and nodes.
- **Models**:
    - **`MindMap(Base)`**:
        - Tablename: `mindmaps`
        - Columns:
            - `id` (Integer, primary_key, index): Unique ID for the mindmap.
            - `title` (String(255), nullable=False): Title of the mindmap.
            - `created_at` (DateTime, default=utcnow): Timestamp of creation.
            - `updated_at` (DateTime, default/onupdate=utcnow): Timestamp of last update.
        - Relationships:
            - `nodes`: One-to-many relationship to `Node` model. `cascade="all, delete-orphan"` ensures that when a `MindMap` is deleted, all its associated `Node`s are also deleted.
    - **`Node(Base)`**:
        - Tablename: `nodes`
        - Columns:
            - `id` (Integer, primary_key, index): Unique ID for the node.
            - `content` (Text, nullable=False): Text content of the node.
            - `x_pos` (Integer, nullable=True): Saved X position (used if layouts are persisted).
            - `y_pos` (Integer, nullable=True): Saved Y position.
            - `mindmap_id` (Integer, ForeignKey("mindmaps.id")): Foreign key linking to the parent `MindMap`.
            - `parent_id` (Integer, ForeignKey("nodes.id"), nullable=True): Foreign key for self-referential relationship, linking to a parent `Node` (if not a root node).
        - Relationships:
            - `mindmap`: Many-to-one relationship back to `MindMap`.
            - `children`: One-to-many self-referential relationship to other `Node`s (its children). Uses `backref="parent"` to establish the parent link from the child's perspective. `cascade="all"` ensures deletion of children when a parent node is deleted. `single_parent=True` might be used for certain ORM behaviors.
- **Dependencies**: `sqlalchemy` (Column, Integer, String, etc.), `datetime`, `..database.database.Base` (declarative base for SQLAlchemy models).

#### `src/database/database.py`
- **Purpose**: Configures and manages the database connection and sessions using SQLAlchemy.
- **Key Components**:
    - **`DATABASE_URL`**: Connection string for the PostgreSQL database (e.g., `postgresql://postgres:postgres@localhost:5432/mindmap`).
    - **`engine`**: SQLAlchemy engine created with `create_engine()`.
        - Configured with `QueuePool` for connection pooling.
        - `echo=True` is set, which will log all SQL statements executed by SQLAlchemy (useful for debugging).
        - Includes a connection test (`conn.execute(text("SELECT 1"))`) on startup to verify database accessibility.
    - **`SessionLocal`**: A session factory created with `sessionmaker()`, configured for non-autocommit and non-autoflush sessions bound to the engine.
    - **`Base`**: An instance of `declarative_base()`, used as the base class for ORM models (e.g., in `src/mindmap/models.py`).
    - **`get_db()`**: A dependency function (typically for FastAPI) that provides a database session.
        - It creates a new session from `SessionLocal`.
        - Uses a `try...finally` block to ensure the session is closed (`db.close()`) after its use, whether an exception occurred or not.
        - `yield db` makes it a generator, suitable for FastAPI's `Depends` system.
- **Logging**: Basic logging is configured to show info and error messages related to database operations.

#### `static/js/examples/structures.js`
- **Purpose**: Provides functionality to load and parse predefined mindmap structures, including from text definitions and a JSON file.
- **Key Functions**:
    - **`parseStructure(text)`**:
        - Takes a multi-line string where indentation signifies hierarchy and lines are like "key: content".
        - Parses this text format into a nested JavaScript object structure (`{ content, key, children: [] }`).
    - **`parseJsonStructure(json)`**:
        - Specifically designed to parse a `tableOfContents.json` format.
        - Expects a root `table_of_contents` array.
        - Recursively converts the JSON nodes (with `title`, `page`, `children`) into the internal structure format (`{ content, key, page, children: [] }`).
    - **`getAvailableStructures()`**:
        - Returns a list of names of predefined structures (from `structureDefinitions.js`) plus "JSON" as an option.
    - **`getStructure(name)`**:
        - If `name` is "JSON", it fetches `/static/js/examples/tableOfContents.json`, parses it using `parseJsonStructure`.
        - Otherwise, it retrieves a text-based structure definition from `structureDefinitions.js` (not provided, but imported) and parses it using `parseStructure`.
- **Dependencies**: `./structureDefinitions.js` (for predefined text-based structures).

#### `static/js/examples/MindmapBuilder.js`
- **Purpose**: Provides a class (`MindmapBuilder`) and function (`buildStructure`) to programmatically create a new mindmap on the backend and then populate it with nodes based on a given structure (obtained from `structures.js`).
- **Class `MindmapBuilder`**:
    - **`constructor()`**: Initializes state like `currentMindmapId`, `nodeMap` (to map logical keys to backend node IDs), and `rootNodeCreated` flag.
    - **`createStructure(title, structure)`**:
        - **1. Create Mindmap**: Makes a POST API call to `/mindmaps/` to create a new mindmap with the given `title`.
        - **2. Update UI & WebSocket**: Updates the UI to show the new mindmap ID and connects the WebSocket.
        - **3. Create Root Node**: Makes a POST API call to `/mindmaps/{mindmapId}/root` to create the root node with `structure.content`.
        - **4. Render Root Node**: Calls `createNodeGroup` to visually render the root node on the frontend.
        - **5. Add Children**: Recursively calls `addChildWithDelay` for each child in the `structure.children` array. Uses `setTimeout` to introduce delays between adding nodes.
    - **`addChildWithDelay(parentKey, nodeStructure)`**:
        - Retrieves the parent node's backend ID from `this.nodeMap`.
        - Makes a POST API call to `/mindmaps/{mindmapId}/nodes` to create the child node with `nodeStructure.content` (or `nodeStructure.title`) and the `parent_id`.
        - Stores the new node's ID in `this.nodeMap`.
        - **Synchronization Attempt**: Includes a loop with `setInterval` to wait until the newly created node appears in the DOM (selected via `mindMapState.getGroup().select(...)`) before proceeding to add its children. This is a frontend attempt to wait for the backend + WebSocket update + D3 rendering cycle to complete.
        - Recursively calls itself for children of the current node.
- **Function `buildStructure(structureName)`**:
    - An async wrapper that gets a structure definition using `getStructure` (from `structures.js`).
    - Creates an instance of `MindmapBuilder`.
    - Calls `builder.createStructure()` to build the mindmap.
- **Note**: This builder makes individual API calls for each node. It relies on the WebSocket updates (handled in `mindmap.js` or `WebSocket.js`) to eventually trigger the full re-layout and animation of the mindmap as nodes are added server-side. The `createNodeGroup` call for the root node in `MindmapBuilder` is a direct frontend rendering, while subsequent nodes added via API calls in `addChildWithDelay` would primarily be rendered via the WebSocket `node_created` message handler. The synchronization logic (`checkNode`) suggests an attempt to manage the timing of these asynchronous operations.
- **Dependencies**: `../config/state.js`, `../components/Node.js`, `../utils/EventHandlers.js`, `../network/WebSocket.js`, `./structures.js`.

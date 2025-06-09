import * as config from './config/config.js';
import { LAYOUT, ZOOM_SETTINGS } from './config/config.js';
import { mindMapState } from './config/state.js';
import TreeLayout from './layout/TreeLayout.js';
import { createNodeGroup, createConnection /*, createConnectorDot */ } from './components/Node.js';
import { animateConnection } from './components/Animation.js';
import { connectWebSocket } from './network/WebSocket.js';
import { createMindmap, createRootNode, addChildNode, loadMindmapStructure } from './network/ApiClient.js';
import { handleNodeClick, clearSelection, handleResize } from './utils/EventHandlers.js';
import { initNavigation, updateHeaderList } from './utils/Navigation.js';
import { initColorCustomization } from './customization/ColorManager.js';

class Mindmap {
    constructor() {
        this.currentNodes = [];
        this.selectedNodeId = null;
        this.currentMindmapId = null;
        this.layout = new TreeLayout();
        this.layoutNodes = [];
    }

    getLayoutNodes() {
        return this.layoutNodes;
    }

    init() {
        this.initNetwork();
        this.initEventListeners();
        initNavigation();
    }

    // Add method to set current mindmap
    setCurrentMindmap(mindmapId) {
        this.currentMindmapId = mindmapId;
        // Only connect WebSocket when we have a mindmap
        if (mindmapId) {
            connectWebSocket(mindmapId);
        }
    }

    // Update the createMindmap function
    async createMindmap(name) {
        try {
            const response = await createMindmap(name);
            this.setCurrentMindmap(response.id);
            return response;
        } catch (error) {
            console.error('Error creating mindmap:', error);
            throw error;
        }
    }

    initNetwork() {
        const container = document.getElementById('mindmap');
        mindMapState.setDimensions(container.clientWidth, container.clientHeight);

        const svg = d3.select('#mindmap')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .on('click', (event) => {
                if (event.target.tagName === 'svg') {
                    this.clearSelection();
                }
            });
        
        mindMapState.setSvg(svg);

        // Option B: Set initial transform to focus on top-left.
        // updateLayout will NOT override this with auto-fit.
        const initialTranslateX = ZOOM_SETTINGS.INITIAL_TRANSLATE_X || 50;
        const initialTranslateY = ZOOM_SETTINGS.INITIAL_Y_OFFSET || 50;
        const initialScale = ZOOM_SETTINGS.INITIAL_SCALE || 1.0;
        
        const initialTransform = d3.zoomIdentity
            .translate(initialTranslateX, initialTranslateY)
            .scale(initialScale);
        mindMapState.setCurrentTransform(initialTransform);

        this.setupBackground(svg);
        this.setupZoom(svg, initialTransform); // Pass initialTransform
    }

    setupBackground(svg) {
        const defs = svg.append('defs');
        
        // Grid pattern
        const pattern = defs.append('pattern')
            .attr('id', 'grid-pattern')
            .attr('width', 30)
            .attr('height', 30)
            .attr('patternUnits', 'userSpaceOnUse');

        pattern.append('rect')
            .attr('width', 30)
            .attr('height', 30)
            .attr('fill', '#0A0A0A');

        pattern.append('circle')
            .attr('cx', 2)
            .attr('cy', 2)
            .attr('r', 0.8)
            .attr('fill', 'rgba(255, 255, 255, 0.08)');

        // Background with pattern
        svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'url(#grid-pattern)');

        // Vignette effect
        const gradient = defs.append('radialGradient')
            .attr('id', 'vignette')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '85%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('style', 'stop-color: #0A0A0A; stop-opacity: 0.1');

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('style', 'stop-color: #0A0A0A; stop-opacity: 0.3');

        svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'url(#vignette)');

        const g = svg.append('g');
        mindMapState.setGroup(g);
    }

    setupZoom(svg, initialTransform) {
        const zoom = d3.zoom()
            .scaleExtent([config.ZOOM_SETTINGS.MIN_SCALE, config.ZOOM_SETTINGS.MAX_SCALE])
            .on('zoom', (event) => {
                mindMapState.getGroup().attr('transform', event.transform);
                mindMapState.setCurrentTransform(event.transform);
            });

        mindMapState.setZoom(zoom);

        svg.call(zoom)
           .call(zoom.transform, initialTransform);
    }

    initEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
        
        // Add sidebar toggle functionality
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        sidebarToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('collapsed');
            
            // Wait for animation and update dimensions
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 300);
        });
    }

    handleNodeClick = (event, nodeData) => {
        event.stopPropagation();
        this.selectedNodeId = nodeData.id;
        mindMapState.getGroup().selectAll('.node').classed('selected', false);
        // Update UI to show selected node info if needed
    }

    clearSelection = () => {
        this.selectedNodeId = null;
        mindMapState.getGroup().selectAll('.node').classed('selected', false);
        // Update UI to clear selected node info if needed
    }

    handleResize() {
        const container = document.getElementById('mindmap');
        const { width, height } = container.getBoundingClientRect();
        mindMapState.setDimensions(width, height);
        mindMapState.getSvg()
            .attr('width', width)
            .attr('height', height);
    }

    async updateLayout(nodesData) { 
        console.log("updateLayout called with nodesData:", nodesData); 
        this.currentNodes = nodesData; 
        
        const rootTreeNodeFromHierarchy = this.layout.buildTree(nodesData); 
        if (!rootTreeNodeFromHierarchy) {
            console.warn("No root node found by buildTree. Clearing canvas.");
            mindMapState.getGroup().selectAll('*').remove();
            return;
        }
        
        const layoutNodes = await this.layout.calculateLayout(rootTreeNodeFromHierarchy);
        this.layoutNodes = layoutNodes;
        await updateHeaderList(this.layoutNodes);

        const allLayoutNodesMap = new Map(layoutNodes.map(n => [n.id, n]));

        mindMapState.getGroup().selectAll('*').remove(); 
        
        const rootLayoutNode = allLayoutNodesMap.get(rootTreeNodeFromHierarchy.id);

        if (rootLayoutNode) {
            // 1. Create and show the root node first (no incoming line animation)
            await createNodeGroup(rootLayoutNode, this.handleNodeClick); // createNodeGroup now returns a promise
            
            // 2. Then, start recursive animation for its children
            if (config.ANIMATION.ENABLED) {
                await this._animateTreeRecursive(rootLayoutNode, allLayoutNodesMap);
            } else {
                // If animation is disabled, just draw everything statically
                for (const node of layoutNodes) {
                    if (node.id === rootLayoutNode.id) continue; // Root already drawn
                    
                    const parentLayoutNode = node.parentId ? allLayoutNodesMap.get(node.parentId) : null;
                    if (parentLayoutNode) {
                         createConnection(parentLayoutNode, node); // Create connection (no animation)
                    }
                    createNodeGroup(node, this.handleNodeClick); // Create node (no animation for the group itself)
                }
            }
        } else {
            console.warn("Root node from hierarchy not found in layoutNodes map.");
        }
    }

    async _animateTreeRecursive(parentNodeLayoutData, allLayoutNodesMap) {
        const parentTreeNode = this.layout.nodeMap.get(parentNodeLayoutData.id);
        if (!parentTreeNode || !parentTreeNode.children || parentTreeNode.children.length === 0) {
            return; // No children to animate for this parent
        }

        const childrenLayoutData = parentTreeNode.children
            .map(childTreeNode => allLayoutNodesMap.get(childTreeNode.id))
            .filter(Boolean);

        if (childrenLayoutData.length === 0) return;

        // For each child, we'll have a sequence: animate its line, then create its node, then recurse.
        // These sequences for sibling children will run concurrently.
        const childAnimationSequences = childrenLayoutData.map(async (childLayout) => {
            // 1. Animate connection to this specific child
            const link = createConnection(parentNodeLayoutData, childLayout);
            if (link && !link.empty() && link.attr('d') && link.attr('d') !== "") {
                await new Promise(resolve => { // Wait for this specific line to finish
                    animateConnection(link, resolve);
                });
            }
            // If no link or empty path, we proceed directly to node creation for this child.

            // 2. Create and animate (fade-in) this child node, after its line is done
            await createNodeGroup(childLayout, this.handleNodeClick);

            // 3. Recursively call this function for this child node
            //    to animate its respective children's lines and nodes.
            //    This recursive call will also run its course before this child's "sequence" promise resolves.
            await this._animateTreeRecursive(childLayout, allLayoutNodesMap);
        });

        // Wait for all child animation sequences (line -> node -> recursion) to complete
        // before this level of recursion considers itself "done".
        await Promise.all(childAnimationSequences);
    }

    async addNode(parentId, label) { // Corresponds to "Add Child Node" button (via ApiClient)
        try {
            // When adding a node via UI, the backend determines its properties.
            // The `type` of the new node needs to be sent from the backend in the response
            // or in the WebSocket message.
            const newNodeFromApi = await addChildNode(parentId, label); // ApiClient.addChildNode
            
            // Ensure newNodeFromApi has a 'type' property before adding to layout.
            // This might require backend changes or inference here.
            if (!newNodeFromApi.type) {
                console.warn("New node from API is missing 'type'. Defaulting or inferring may be needed.", newNodeFromApi);
                // Example: newNodeFromApi.type = 'default'; // or try to infer
            }

            this.addNodeToLayout(newNodeFromApi); // Pass the node data from the API
            return newNodeFromApi;
        } catch (error) {
            console.error('Error adding node:', error);
            throw error;
        }
    }

    // Add this helper method to determine if a node will be a leaf
    isNodeLeafInStructure(nodeId) {
        // A node is a leaf if it's not a parent in any existing node
        return !this.currentNodes.some(node => node.parent_id === nodeId);
    }

    getCurrentNodes() {
        return this.currentNodes;
    }

    async addNodeToLayout(newNodeData) { // newNodeData is a single raw node object from API/user input
        const existingNode = this.currentNodes.find(n => n.id === newNodeData.id);
        if (!existingNode) {
            this.currentNodes.push(newNodeData);
        } else {
            Object.assign(existingNode, newNodeData);
        }
        await this.updateLayout([...this.currentNodes]);
    }

    removeNode(nodeId) {
        this.currentNodes = this.currentNodes.filter(n => n.id !== nodeId);
        this.updateLayout(this.currentNodes);
    }

    async buildSelectedStructure() {
        try {
            console.log("Build Example Structure clicked"); // 1. Check if function is called
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
            
            await new Promise(resolve => setTimeout(resolve, 300));
            window.dispatchEvent(new Event('resize'));
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log("Fetching sample_input.json..."); // 2. Before fetch
            const response = await fetch('/static/js/examples/sample_input_test.json');
            console.log("Fetch response status:", response.status); // 3. After fetch
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching sample_input.json`);
            }
            const structureData = await response.json(); 
            console.log("Loaded structureData from JSON:", structureData); // 4. Check loaded data

            if (!Array.isArray(structureData) || structureData.length === 0) {
                console.error("structureData is not a valid array or is empty!");
                alert("Failed to load valid example structure. Check console.");
                return;
            }
            if (!structureData.every(node => node.hasOwnProperty('type'))) {
                console.error("Some nodes in structureData are missing the 'type' property!");
                alert("Example structure is missing 'type' property on some nodes. Check console and sample_input.json.");
                // You could even log which ones are missing:
                // structureData.forEach((node, index) => {
                //    if (!node.hasOwnProperty('type')) console.log(`Node at index ${index} missing type:`, node);
                // });
                return;
            }
            
            await this.updateLayout(structureData);
        } catch (error) {
            console.error('Error building structure:', error);
            // Potentially display this error to the user in the UI
            const currentMindmapDiv = document.getElementById('currentMindmap');
            if (currentMindmapDiv) {
                currentMindmapDiv.textContent = `Error: ${error.message}`;
            }
            throw error; // Re-throw if needed elsewhere
        }
    }
}

// Create singleton instance
const mindmap = new Mindmap();

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    mindmap.init();
    initColorCustomization();
});

// Export the singleton instance
export default mindmap;

// Export functions for HTML access
window.createMindmap = async (name) => {
    try {
        // This assumes 'mindmap' instance is correctly initialized and available.
        const mindmapInstance = mindmap; // Get the global instance
        if (!mindmapInstance) throw new Error("Mindmap instance not found.");
        const mindmapTitle = document.getElementById('mindmapTitle')?.value || name;
        if (!mindmapTitle) {
            alert("Please enter a mindmap title.");
            return;
        }
        const newMindmap = await mindmapInstance.createMindmap(mindmapTitle); // Call instance method
        const currentMindmapDiv = document.getElementById('currentMindmap');
        if (currentMindmapDiv) {
            currentMindmapDiv.textContent = `Current Mindmap: ${newMindmap.id} - ${newMindmap.title}`;
        }
        return newMindmap;
    } catch (error) {
        console.error('Error creating mindmap via window function:', error);
        alert(`Error creating mindmap: ${error.message}`);
    }
};

window.createRootNode = async (content) => {
    // This interacts with ApiClient.js -> backend.
    // The backend response or WebSocket message for the created root node
    // MUST include the 'type' (e.g., 'title') for the new layout.
    try {
        const mindmapInstance = mindmap;
        if (!mindmapInstance.currentMindmapId) {
            alert("Please create or select a mindmap first.");
            return;
        }
        const rootContent = document.getElementById('rootContent')?.value || content;
        if (!rootContent) {
            alert("Please enter content for the root node.");
            return;
        }
        // Assuming createRootNode in ApiClient.js is wired up.
        // The result from this operation (likely via WebSocket update) will trigger addNodeToLayout
        const rootNode = await createRootNode(rootContent); // This is from ApiClient
        // If createRootNode directly returns data, it needs to be added to layout.
        // More likely, this is handled by WebSocket message.
        console.log("Root node creation requested:", rootNode);
         // If not handled by WebSocket, manually update:
        if (rootNode && !mindmapInstance.getCurrentNodes().find(n => n.id === rootNode.id)) {
            // Ensure rootNode has 'type' property, e.g. rootNode.type = 'title';
            if(!rootNode.type) rootNode.type = 'title'; // Assign default type for root
            mindmapInstance.addNodeToLayout(rootNode);
        }

    } catch (error) {
        console.error('Error creating root node via window function:', error);
        alert(`Error creating root node: ${error.message}`);
    }
};

window.addChildNode = async (content) => { // Removed parentId from here, selectedNodeId will be used
    try {
        const mindmapInstance = mindmap;
        if (!mindmapInstance.currentMindmapId) {
            alert("Please create or select a mindmap first.");
            return;
        }
        if (!mindmapInstance.selectedNodeId) {
            alert("Please select a parent node first.");
            return;
        }
        const nodeContent = document.getElementById('nodeContent')?.value || content;
        if (!nodeContent) {
            alert("Please enter content for the child node.");
            return;
        }
        // mindmap.addNode handles calling ApiClient.addChildNode and then addNodeToLayout
        await mindmapInstance.addNode(mindmapInstance.selectedNodeId, nodeContent);
    } catch (error) {
        console.error('Error adding child node via window function:', error);
        alert(`Error adding child node: ${error.message}`);
    }
};

window.loadMindmapStructure = loadMindmapStructure;
window.buildSelectedStructure = () => mindmap.buildSelectedStructure(); 
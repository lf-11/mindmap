import { mindMapState } from '../config/state.js';
import { createNodeGroup } from '../components/Node.js';
import { handleNodeClick } from '../utils/EventHandlers.js';
import { connectWebSocket } from './WebSocket.js';
import TreeLayout from '../layout/TreeLayout.js';
import { addNodeWithAnimation } from '../components/Animation.js';
import * as config from '../config/config.js';

/**
 * Creates a new mindmap
 * @param {string} title - Title of the mindmap
 */
export async function createMindmap(title) {
    if (!title) return;

    const response = await fetch('/mindmaps/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
    });

    const mindmap = await response.json();
    mindMapState.setCurrentMindmapId(mindmap.id);
    document.getElementById('currentMindmap').innerHTML = 
        `Current Mindmap: ${title} (ID: ${mindmap.id})`;
    
    mindMapState.getGroup().selectAll('*').remove();
    connectWebSocket(mindmap.id);
}

/**
 * Creates a root node for the mindmap
 */
export async function createRootNode(content) {
    if (!mindMapState.getCurrentMindmapId() || !content) return;

    const response = await fetch(
        `/mindmaps/${mindMapState.getCurrentMindmapId()}/root?content=${encodeURIComponent(content)}`,
        { method: 'POST' }
    );

    const node = await response.json();
    const rootNode = {
        id: node.id,
        label: node.content,
        parent_id: null,
        isRoot: true
    };

    mindMapState.getGroup().selectAll('*').remove();

    if (mindMapState.getCurrentTransform()) {
        mindMapState.getGroup().attr('transform', mindMapState.getCurrentTransform());
    }

    // Use the layout system to position the root node
    const layout = new TreeLayout();
    const root = layout.buildTree([rootNode]);
    await layout.calculateLayout(root);

    createNodeGroup({
        ...rootNode,
        x: root.x,
        y: root.y
    }, handleNodeClick);
    
    document.getElementById('rootContent').value = '';
}

/**
 * Adds a child node to the selected node
 */
export async function addChildNode(parentId, content) {
    if (!mindMapState.getCurrentMindmapId()) {
        alert('Please create a mindmap first');
        return;
    }
    if (!parentId) {
        alert('Please select a parent node first');
        return;
    }
    if (!content) {
        alert('Please enter node content');
        return;
    }

    const response = await fetch(`/mindmaps/${mindMapState.getCurrentMindmapId()}/nodes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content,
            parent_id: parentId
        })
    });

    const newNode = await response.json();
    document.getElementById('nodeContent').value = '';
    return {
        id: newNode.id,
        label: newNode.content,
        parent_id: parentId
    };
}

/**
 * Loads the structure of an existing mindmap
 */
export async function loadMindmapStructure(mindmapId) {
    const response = await fetch(`/mindmaps/${mindmapId}/structure`);
    const structure = await response.json();
    
    mindMapState.getGroup().selectAll('*').remove();
    
    // Convert structure to flat array for layout
    const nodes = [];
    function flattenStructure(nodeData, parentId = null) {
        nodes.push({
            id: nodeData.id,
            label: nodeData.content,
            parent_id: parentId
        });
        
        for (const child of nodeData.children) {
            flattenStructure(child, nodeData.id);
        }
    }
    flattenStructure(structure);

    // Calculate layout for all nodes
    const layout = new TreeLayout();
    const root = layout.buildTree(nodes);
    const layoutNodes = await layout.calculateLayout(root);

    // Add nodes sequentially with animation
    for (const node of layoutNodes) {
        if (!node.isFake) {
            const nodeData = {
                ...nodes.find(n => n.id === node.id),
                x: node.x,
                y: node.y,
                isLeaf: node.isLeaf
            };

            if (node.parentId) {
                const parent = layoutNodes.find(n => n.id === node.parentId);
                const connectToDot = parent.children.some(child => 
                    child.isFake && child.children.includes(node));

                if (connectToDot) {
                    const dot = layoutNodes.find(n => 
                        n.isFake && n.parentId === node.parentId);
                    nodeData.connectToDot = true;
                    nodeData.dotX = dot.x;
                    nodeData.dotY = dot.y;
                } else {
                    nodeData.parentX = parent.x;
                    nodeData.parentY = parent.y;
                }
            }

            await addNodeWithAnimation(nodeData, handleNodeClick);
            await new Promise(resolve => 
                setTimeout(resolve, config.ANIMATION.TRANSITION_DELAY));
        }
    }
} 
class MindMapState {
    constructor() {
        this.svg = null;
        this.g = null;
        this.currentMindmapId = null;
        this.selectedNodeId = null;
        this.ws = null;
        this.width = null;
        this.height = null;
        this.currentTransform = null;
        this.zoom = null;
    }

    // Getters
    getSvg() { return this.svg; }
    getGroup() { return this.g; }
    getCurrentMindmapId() { return this.currentMindmapId; }
    getSelectedNodeId() { return this.selectedNodeId; }
    getWebSocket() { return this.ws; }
    getDimensions() { return { width: this.width, height: this.height }; }
    getCurrentTransform() { return this.currentTransform; }
    getZoom() { return this.zoom; }
    
    // Setters
    setSvg(svg) { this.svg = svg; }
    setGroup(g) { this.g = g; }
    setCurrentMindmapId(id) { this.currentMindmapId = id; }
    setSelectedNode(id) { this.selectedNodeId = id; }
    setWebSocket(ws) { this.ws = ws; }
    setDimensions(width, height) {
        this.width = width;
        this.height = height;
    }
    setCurrentTransform(transform) { this.currentTransform = transform; }
    setZoom(zoom) { this.zoom = zoom; }

    // Clear state
    clear() {
        this.selectedNodeId = null;
    }
}

// Create and export a singleton instance
export const mindMapState = new MindMapState(); 
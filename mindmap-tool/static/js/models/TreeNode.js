class TreeNode {
    constructor(id, label, parentId) {
        this.id = id;
        this.label = label;
        this.parentId = parentId;
        this.children = [];
        this.x = 0;
        this.y = 0;
        this.level = 0;
        this.isLeaf = false;
        this.isRoot = false;
        this.isFake = false;
        this.type = 'default';
        this.width = 0;
        this.height = 0;
    }
}

export default TreeNode;

export class NodeGroup {
    constructor(parentNode) {
        this.parent = parentNode;
        this.leaves = [];
        this.nonLeaves = [];
        this.dimensions = {
            totalWidth: 0,
            height: 0,
            xStart: 0
        };
        this.hasConnectorDot = false;
        this.dotPosition = null;
    }

    get totalChildren() {
        return this.leaves.length + this.nonLeaves.length;
    }

    shouldUseConnectorDot() {
        return this.leaves.length >= 2;
    }

    addNode(node) {
        if (node.isLeaf) {
            this.leaves.push(node);
        } else {
            this.nonLeaves.push(node);
        }
    }
} 
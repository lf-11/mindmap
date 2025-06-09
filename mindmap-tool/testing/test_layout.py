import json
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as patches

class TreeNode:
    def __init__(self, id, label, parent_id):
        self.id = id
        self.label = label
        self.parent_id = parent_id
        self.children = []
        self.x = 0
        self.y = 0
        self.level = 0
        self.is_leaf = False
        self.is_root = False
        self.is_fake = False

def build_tree(json_data):
    nodes = {}
    for item in json_data:
        node = TreeNode(item['id'], item['label'], item['parent_id'])
        node.is_root = item['parent_id'] is None
        nodes[item['id']] = node
        
    for node in nodes.values():
        if node.parent_id is not None:
            parent = nodes[node.parent_id]
            parent.children.append(node)
            parent.is_leaf = False
            
    # Determine leaves
    for node in nodes.values():
        node.is_leaf = len(node.children) == 0
        
    return nodes

def calculate_layout(root, nodes):
    # First pass: calculate levels (unchanged)
    def assign_levels(node, level):
        node.level = level
        for child in node.children:
            assign_levels(child, level + 1)
    assign_levels(root, 0)

    # Keep track of used positions at each level
    used_positions = {}

    # Helper function to find next available x position at a given y level
    def find_available_position(x_pos, y_level, x_spacing=150):
        if y_level not in used_positions:
            used_positions[y_level] = set()
            return x_pos
        
        while any(abs(x - x_pos) < x_spacing for x in used_positions[y_level]):
            x_pos += x_spacing
        return x_pos

    # Second pass: calculate positions
    def layout(node, x_offset, y_spacing=100, x_spacing=150):
        node.y = node.level * y_spacing
        
        if node.is_leaf:
            node.x = find_available_position(x_offset, node.y)
            used_positions.setdefault(node.y, set()).add(node.x)
            return node.x + x_spacing
        
        # Handle leaf stacking logic
        if len(node.children) > 3 and sum(c.is_leaf for c in node.children) >= 2:
            leaves = [c for c in node.children if c.is_leaf]
            non_leaves = [c for c in node.children if not c.is_leaf]
            
            # Create fake node
            fake_node = TreeNode(-node.id, "", node.id)
            fake_node.is_fake = True
            fake_node.parent_id = node.id
            fake_node.children = leaves
            fake_node.level = node.level + 1
            node.children = non_leaves + [fake_node]
            
            # Position fake node first (on the left), but check for available position
            fake_node.y = node.y + y_spacing
            fake_node.x = find_available_position(x_offset, fake_node.y, x_spacing/2)  # Use smaller spacing for dots
            used_positions.setdefault(fake_node.y, set()).add(fake_node.x)
            
            # Position leaves under and to the right of fake node with compact spacing
            leaf_stack_spacing = 20
            leaf_base_y = fake_node.y + y_spacing/2
            
            for i, leaf in enumerate(leaves):
                leaf.level = fake_node.level + 1
                leaf.y = leaf_base_y + i * leaf_stack_spacing
                leaf.x = find_available_position(fake_node.x + x_spacing/2, leaf.y)
                used_positions.setdefault(leaf.y, set()).add(leaf.x)
            
            # Position non-leaf nodes, ensuring they don't overlap with the fake node
            current_x = max(
                fake_node.x + x_spacing * 1.5,  # Minimum distance from fake node
                max((leaf.x for leaf in leaves), default=fake_node.x) + x_spacing  # Minimum distance from rightmost leaf
            )
            
            for child in non_leaves:
                current_x = layout(child, current_x)
            
            # Center the current node above all its children
            if node.is_root:
                leftmost = fake_node.x
                rightmost = max(child.x for child in non_leaves)
                node.x = (leftmost + rightmost) / 2
            else:
                node.x = (fake_node.x + sum(child.x for child in non_leaves)) / (len(non_leaves) + 1)
                
            return current_x
        else:
            # Regular layout
            child_x = x_offset
            child_positions = []
            for child in node.children:
                child_x = layout(child, child_x)
                child_positions.append(child.x)
            
            if child_positions:
                node.x = sum(child_positions) / len(child_positions)
            else:
                node.x = x_offset
            used_positions.setdefault(node.y, set()).add(node.x)
            return max(child_positions) if child_positions else x_offset + x_spacing 

    layout(root, 0)
    
    # Collect all nodes including fake ones
    all_nodes = list(nodes.values())
    for node in nodes.values():
        for child in node.children:
            if child.is_fake:
                all_nodes.append(child)
                all_nodes.extend(child.children)
                
    return all_nodes

def visualize_layout(nodes):
    # Calculate figure size based on number of nodes and tree dimensions
    all_x = [n.x for n in nodes]
    all_y = [-n.y for n in nodes]
    width_range = max(all_x) - min(all_x)
    height_range = max(all_y) - min(all_y)
    
    # Dynamic figure size with minimum dimensions
    fig_width = max(12, width_range / 100)
    fig_height = max(8, height_range / 100)
    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    
    # First, create a map of fake nodes and their children for quick lookup
    fake_node_children = {}
    for node in nodes:
        if node.is_fake:
            fake_node_children.update({child.id: node for child in node.children})
    
    # Calculate appropriate node size based on the number of nodes
    node_width = min(100, max(30, 1000 / len(nodes)))
    node_height = min(30, max(15, 300 / len(nodes)))
    text_size = min(10, max(6, 200 / len(nodes)))
    
    for node in nodes:
        if node.is_fake:
            # Draw fake node as dot
            ax.plot(node.x, -node.y, 'ko', markersize=4)
            
            # Connect to parent
            if node.parent_id:
                parent = next(n for n in nodes if n.id == node.parent_id)
                ax.plot([parent.x, node.x], [-parent.y, -node.y], 'k-', linewidth=0.5)
            
            # Connect to children
            for child in node.children:
                ax.plot([node.x, child.x], [-node.y, -child.y], 'k-', linewidth=0.5)
        else:
            # Draw regular node
            color = 'lightgray' if node.is_leaf else 'white'
            rect = patches.Rectangle(
                (node.x - node_width/2, -node.y - node_height/2),
                node_width, node_height,
                facecolor=color,
                edgecolor='black',
                alpha=0.7,
                linewidth=0.5
            )
            ax.add_patch(rect)
            ax.text(node.x, -node.y, node.label,
                    horizontalalignment='center',
                    verticalalignment='center',
                    fontsize=text_size)
            
            # Connect to parent only if not root and not connected to a fake node
            if node.parent_id and not node.is_root and node.id not in fake_node_children:
                parent = next(n for n in nodes if n.id == node.parent_id)
                ax.plot([parent.x, node.x], [-parent.y, -node.y], 'k-', linewidth=0.5)

    ax.set_axis_off()
    
    # Add padding to the plot
    x_padding = width_range * 0.1
    y_padding = height_range * 0.1
    plt.xlim(min(all_x) - x_padding, max(all_x) + x_padding)
    plt.ylim(min(all_y) - y_padding, max(all_y) + y_padding)
    
    # Adjust layout to prevent clipping
    plt.tight_layout()
    plt.show()


nodes = build_tree(json_data)
root = nodes[1]
all_nodes = calculate_layout(root, nodes)

# Create DataFrame
df = pd.DataFrame([{
    'id': n.id,
    'label': n.label,
    'parent_id': n.parent_id,
    'x_pos': n.x,
    'y_pos': n.y,
    'is_leaf': n.is_leaf,
    'is_root': n.is_root,
    'level': n.level
} for n in all_nodes if not n.is_fake])

print("Node Positions:")
print(df[['id', 'label', 'x_pos', 'y_pos']])

visualize_layout(all_nodes)
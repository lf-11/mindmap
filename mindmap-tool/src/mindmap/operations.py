from ..database.database import engine, Base
from . import models
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from fastapi import HTTPException

def init_db():
    """Initialize the database, creating all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)

def create_mindmap(db: Session, title: str):
    """Create a new mindmap."""
    mindmap = models.MindMap(title=title)
    db.add(mindmap)
    db.commit()
    db.refresh(mindmap)
    return mindmap

def create_root_node(db: Session, mindmap_id: int, content: str) -> models.Node:
    """Create the initial root/head node of the mindmap"""
    # Check if mindmap already has a root node
    existing_root = db.query(models.Node).filter(
        models.Node.mindmap_id == mindmap_id,
        models.Node.parent_id == None
    ).first()
    
    if existing_root:
        raise HTTPException(status_code=400, detail="Mindmap already has a root node")
    
    root_node = models.Node(
        content=content,
        mindmap_id=mindmap_id,
        x_pos=0,
        y_pos=0
    )
    db.add(root_node)
    db.commit()
    db.refresh(root_node)
    return root_node

def add_child_node(db: Session, parent_id: int, content: str, x_pos: int = 0, y_pos: int = 0) -> models.Node:
    """Add a single child node to any existing node"""
    parent = db.query(models.Node).filter(models.Node.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent node not found")
    
    child_node = models.Node(
        content=content,
        mindmap_id=parent.mindmap_id,
        parent_id=parent_id,
        x_pos=x_pos,
        y_pos=y_pos
    )
    db.add(child_node)
    db.commit()
    db.refresh(child_node)
    return child_node

def add_multiple_children(db: Session, parent_id: int, contents: List[str]) -> List[models.Node]:
    """Add multiple child nodes at once to a parent node"""
    parent = db.query(models.Node).filter(models.Node.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent node not found")
    
    children = []
    for i, content in enumerate(contents):
        child = models.Node(
            content=content,
            mindmap_id=parent.mindmap_id,
            parent_id=parent_id,
            x_pos=i * 100,  # Simple horizontal layout
            y_pos=get_depth(db, parent) * 100  # Vertical position based on depth
        )
        children.append(child)
    
    db.add_all(children)
    db.commit()
    for child in children:
        db.refresh(child)
    return children

def get_structure(db: Session, mindmap_id: int, start_node_id: Optional[int] = None) -> Dict:
    """Return the tree structure starting from given node (or root if None)"""
    if start_node_id:
        start_node = db.query(models.Node).filter(models.Node.id == start_node_id).first()
        if not start_node:
            raise HTTPException(status_code=404, detail="Start node not found")
    else:
        start_node = db.query(models.Node).filter(
            models.Node.mindmap_id == mindmap_id,
            models.Node.parent_id == None
        ).first()
        if not start_node:
            raise HTTPException(status_code=404, detail="No root node found")
    
    def build_tree(node):
        children = db.query(models.Node).filter(models.Node.parent_id == node.id).all()
        return {
            "id": node.id,
            "content": node.content,
            "x_pos": node.x_pos,
            "y_pos": node.y_pos,
            "children": [build_tree(child) for child in children]
        }
    
    return build_tree(start_node)

def find_node(db: Session, mindmap_id: int, content: str) -> Optional[models.Node]:
    """Find a node by its content"""
    return db.query(models.Node).filter(
        models.Node.mindmap_id == mindmap_id,
        models.Node.content.ilike(f"%{content}%")
    ).first()

def edit_node_content(db: Session, node_id: int, new_content: str) -> models.Node:
    """Modify the content of an existing node"""
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    node.content = new_content
    db.commit()
    db.refresh(node)
    return node

def delete_node(db: Session, node_id: int) -> None:
    """Delete a node and its subtree"""
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # The cascade delete will handle the subtree due to the relationship setup
    db.delete(node)
    db.commit()

def move_node(db: Session, node_id: int, new_parent_id: int) -> models.Node:
    """Move a node and its subtree to a new parent"""
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    new_parent = db.query(models.Node).filter(models.Node.id == new_parent_id).first()
    if not new_parent:
        raise HTTPException(status_code=404, detail="New parent node not found")
    
    # Prevent circular references
    if new_parent_id == node_id or is_descendant(db, node_id, new_parent_id):
        raise HTTPException(status_code=400, detail="Cannot move node to its own descendant")
    
    node.parent_id = new_parent_id
    db.commit()
    db.refresh(node)
    return node

def get_depth(db: Session, node: models.Node) -> int:
    """Return the depth level of a given node"""
    depth = 0
    current = node
    while current.parent_id is not None:
        depth += 1
        current = db.query(models.Node).filter(models.Node.id == current.parent_id).first()
    return depth

def is_descendant(db: Session, ancestor_id: int, descendant_id: int) -> bool:
    """Helper function to check if a node is a descendant of another node"""
    current = db.query(models.Node).filter(models.Node.id == descendant_id).first()
    while current and current.parent_id is not None:
        if current.parent_id == ancestor_id:
            return True
        current = db.query(models.Node).filter(models.Node.id == current.parent_id).first()
    return False

def add_node(db: Session, mindmap_id: int, content: str, parent_id: int = None, x_pos: int = 0, y_pos: int = 0) -> models.Node:
    """Add a node to the mindmap"""
    # Verify mindmap exists
    mindmap = db.query(models.MindMap).filter(models.MindMap.id == mindmap_id).first()
    if not mindmap:
        raise HTTPException(status_code=404, detail="Mindmap not found")
    
    # If parent_id is provided, verify parent exists
    if parent_id:
        parent = db.query(models.Node).filter(
            models.Node.id == parent_id,
            models.Node.mindmap_id == mindmap_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent node not found")
    
    node = models.Node(
        content=content,
        mindmap_id=mindmap_id,
        parent_id=parent_id,
        x_pos=x_pos,
        y_pos=y_pos
    )
    
    db.add(node)
    db.commit()
    db.refresh(node)
    return node
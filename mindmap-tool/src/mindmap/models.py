from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship, backref
from datetime import datetime
from ..database.database import Base

class MindMap(Base):
    __tablename__ = "mindmaps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    nodes = relationship("Node", back_populates="mindmap", cascade="all, delete-orphan")

class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    x_pos = Column(Integer)  # For frontend positioning
    y_pos = Column(Integer)  # For frontend positioning
    mindmap_id = Column(Integer, ForeignKey("mindmaps.id"))
    parent_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)
    
    mindmap = relationship("MindMap", back_populates="nodes")
    children = relationship(
        "Node",
        backref=backref("parent", remote_side=[id]),
        cascade="all",
        single_parent=True
    )

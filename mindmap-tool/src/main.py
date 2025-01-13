from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from .database.database import get_db, Base, engine
from .mindmap import operations, models
from pydantic import BaseModel
from datetime import datetime

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Pydantic models for request/response validation
class NodeBase(BaseModel):
    content: str
    x_pos: Optional[int] = 0
    y_pos: Optional[int] = 0
    parent_id: Optional[int] = None

class MindMapCreate(BaseModel):
    title: str

class MindMapResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NodeResponse(BaseModel):
    id: int
    content: str
    x_pos: int
    y_pos: int
    mindmap_id: int
    parent_id: Optional[int]

    class Config:
        from_attributes = True

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, mindmap_id: int):
        await websocket.accept()
        if mindmap_id not in self.active_connections:
            self.active_connections[mindmap_id] = []
        self.active_connections[mindmap_id].append(websocket)

    def disconnect(self, websocket: WebSocket, mindmap_id: int):
        if mindmap_id in self.active_connections:
            self.active_connections[mindmap_id].remove(websocket)

    async def broadcast_to_mindmap(self, mindmap_id: int, message: dict):
        if mindmap_id in self.active_connections:
            for connection in self.active_connections[mindmap_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    try:
        # Create database tables
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
    except Exception as e:
        print(f"Error creating database tables: {e}")
        raise

# CRUD endpoints for MindMap
@app.post("/mindmaps/", response_model=MindMapResponse)
def create_mindmap(mindmap: MindMapCreate, db: Session = Depends(get_db)):
    return operations.create_mindmap(db, mindmap.title)

@app.get("/mindmaps/{mindmap_id}", response_model=MindMapResponse)
def get_mindmap(mindmap_id: int, db: Session = Depends(get_db)):
    mindmap = db.query(models.MindMap).filter(models.MindMap.id == mindmap_id).first()
    if not mindmap:
        raise HTTPException(status_code=404, detail="Mindmap not found")
    return mindmap

@app.get("/mindmaps/{mindmap_id}/nodes", response_model=List[NodeResponse])
def get_mindmap_nodes(mindmap_id: int, db: Session = Depends(get_db)):
    nodes = db.query(models.Node).filter(models.Node.mindmap_id == mindmap_id).all()
    return nodes

@app.post("/mindmaps/{mindmap_id}/nodes", response_model=NodeResponse)
async def create_node(
    mindmap_id: int, 
    node: NodeBase, 
    db: Session = Depends(get_db)
):
    # Create the node
    new_node = operations.add_node(
        db,
        mindmap_id=mindmap_id,
        content=node.content,
        parent_id=node.parent_id,
        x_pos=node.x_pos,
        y_pos=node.y_pos
    )
    
    # Notify all connected clients about the new node
    await manager.broadcast_to_mindmap(
        mindmap_id,
        {
            "type": "node_created",
            "data": {
                "id": new_node.id,
                "content": new_node.content,
                "x_pos": new_node.x_pos,
                "y_pos": new_node.y_pos,
                "parent_id": new_node.parent_id
            }
        }
    )
    
    return new_node

@app.delete("/mindmaps/{mindmap_id}/nodes/{node_id}")
async def delete_node(
    mindmap_id: int,
    node_id: int,
    db: Session = Depends(get_db)
):
    node = db.query(models.Node).filter(
        models.Node.id == node_id,
        models.Node.mindmap_id == mindmap_id
    ).first()
    
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    db.delete(node)
    db.commit()
    
    await manager.broadcast_to_mindmap(
        mindmap_id,
        {
            "type": "node_deleted",
            "data": {"node_id": node_id}
        }
    )
    
    return {"message": "Node deleted"}

# WebSocket endpoint for real-time updates
@app.websocket("/ws/{mindmap_id}")
async def websocket_endpoint(websocket: WebSocket, mindmap_id: int):
    await manager.connect(websocket, mindmap_id)
    try:
        while True:
            # Wait for messages from the client
            data = await websocket.receive_json()
            # Broadcast the message to all connected clients for this mindmap
            await manager.broadcast_to_mindmap(mindmap_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, mindmap_id)

@app.post("/mindmaps/{mindmap_id}/root", response_model=NodeResponse)
def create_root(mindmap_id: int, content: str, db: Session = Depends(get_db)):
    return operations.create_root_node(db, mindmap_id, content)

@app.post("/mindmaps/{mindmap_id}/nodes/{parent_id}/children", response_model=List[NodeResponse])
def add_children(
    mindmap_id: int,
    parent_id: int,
    contents: List[str],
    db: Session = Depends(get_db)
):
    return operations.add_multiple_children(db, parent_id, contents)

@app.get("/mindmaps/{mindmap_id}/structure")
def get_mindmap_structure(
    mindmap_id: int,
    start_node_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return operations.get_structure(db, mindmap_id, start_node_id)


from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from .database.database import get_db, Base, engine
from .mindmap import operations, models
from pydantic import BaseModel
from datetime import datetime
from fastapi.responses import FileResponse
import logging
import json
from pathlib import Path

# Configure logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)  # Only show WARNING and above for SQLAlchemy
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = FastAPI()

# Get the absolute path to the project's root directory.
# This is robust and doesn't depend on where the server is started.
# Assumes this script is at: <project_root>/mindmap-tool/src/main.py
project_root_path = Path(__file__).resolve().parent.parent.parent

# Serve main static files (CSS, JS, etc.)
static_files_dir = project_root_path / "mindmap-tool" / "static"
app.mount("/static", StaticFiles(directory=static_files_dir), name="static")

# Serve the image directory for 'ZPO_temp'.
# This corresponds to the frontend's IMAGE_SETTINGS.BASE_URL.
image_dir_name = "ZPO_temp"
# IMPORTANT: This assumes your `backend` directory is at the same level as `mindmap-tool`.
image_files_dir = project_root_path / "backend" / "processing" / "marker_output" / image_dir_name
app.mount(f"/images/{image_dir_name}", StaticFiles(directory=image_files_dir), name="images_zpo_temp")

logging.info(f"Serving static files from: {static_files_dir}")
logging.info(f"Serving images from /images/{image_dir_name} pointing to: {image_files_dir}")
if not image_files_dir.exists():
    logging.warning(f"Image directory does not exist: {image_files_dir}")

# Pydantic models for request/response validation
class NodeBase(BaseModel):
    content: str
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
    # Create the node without position info
    new_node = operations.add_node(
        db,
        mindmap_id=mindmap_id,
        content=node.content,
        parent_id=node.parent_id
    )
    
    # Update WebSocket notification to exclude position info
    await manager.broadcast_to_mindmap(
        mindmap_id,
        {
            "type": "node_created",
            "data": {
                "id": new_node.id,
                "content": new_node.content,
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

@app.get("/")
async def read_root():
    return FileResponse('static/index.html')

@app.post("/mindmaps/{mindmap_id}/layout")
async def save_mindmap_layout(
    mindmap_id: int,
    node_positions: List[dict],
    db: Session = Depends(get_db)
):
    """Save the current layout of a mindmap"""
    return operations.save_layout(db, mindmap_id, node_positions)

# --- Add this new temporary debug endpoint ---
@app.get("/debug/sample-json")
async def debug_sample_json():
    json_file_path_str = "static/js/examples/sample_input_test.json"
    json_file_path = Path(json_file_path_str)
    
    logging.info(f"Attempting to read debug file: {json_file_path.resolve()}") # Log absolute path

    if not json_file_path.is_file():
        logging.error(f"Debug file not found at: {json_file_path_str}")
        raise HTTPException(status_code=404, detail=f"Debug JSON file not found at {json_file_path_str}")

    try:
        # Check modification time
        mod_time = datetime.fromtimestamp(json_file_path.stat().st_mtime)
        logging.info(f"Debug file '{json_file_path_str}' last modified: {mod_time}")

        with open(json_file_path, 'r') as f:
            content = f.read()
        
        # Print to server console (FastAPI/Uvicorn logs)
        logging.info("--- Debug sample_input.json Content (from server-side read) ---")
        logging.info(content[:500] + "..." if len(content) > 500 else content) # Print first 500 chars
        logging.info("----------------------------------------------------------------")
        
        # Try to parse it as JSON to ensure it's valid
        json_data = json.loads(content)
        return json_data # Return it as JSON response
    except Exception as e:
        logging.error(f"Error reading or parsing debug file '{json_file_path_str}': {e}")
        raise HTTPException(status_code=500, detail=f"Error processing debug JSON file: {str(e)}")


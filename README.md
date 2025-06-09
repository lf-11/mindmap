# mindmap

Use this command to start in /projects/pdf_mindmap/mindmap-tool/

uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload

always ensure port is listening to network traffic, when using on other device
- sudo ufw allow 8001
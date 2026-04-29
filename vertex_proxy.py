"""Entry point for the Vertex proxy server (started as background process).

Usage: python -m vertex_proxy

This is a thin wrapper that imports and calls cli.entrypoints.serve,
which starts the FastAPI/uvicorn server.
"""

from cli.entrypoints import serve

if __name__ == "__main__":
    serve()

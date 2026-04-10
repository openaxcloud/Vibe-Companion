"""Python ML mock service for the polyglot architecture."""

from datetime import datetime
from typing import Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(
    title="E-Code Python ML Mock Service",
    description="Mock implementation that exposes health information without executing ML workloads.",
    version="0.0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_MESSAGE = "Python ML service is running in mock mode and cannot process requests."


@app.get("/health")
async def health() -> Dict[str, object]:
    return {
        "status": "healthy",
        "service": "python-ml",
        "port": 8081,
        "mock": True,
        "message": MOCK_MESSAGE,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "capabilities": ["ai", "ml", "data-processing", "code-analysis"],
        "notes": "This endpoint is provided for integration testing only."
    }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], include_in_schema=False)
async def not_implemented(path: str, request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "error": "not_implemented",
            "message": MOCK_MESSAGE,
            "service": "python-ml",
            "mock": True,
            "method": request.method,
            "path": f"/{path}",
        },
    )


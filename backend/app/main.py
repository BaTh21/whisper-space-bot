from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routers import auth, users, chats, diaries, websockets, friends, groups
from app.models import base
from app.core.database import engine

import os

from app.api.v1.routers import avatar

base.Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Whisper Space",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.mount("/static", StaticFiles(directory="static"), name="static")


app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(diaries.router, prefix="/api/v1/diaries", tags=["diaries"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])
app.include_router(friends.router, prefix="/api/v1/friends", tags=["friends"]) 
app.include_router(websockets.router, prefix="/api/v1", tags=["websockets"])
app.include_router(groups.router, prefix="/api/v1")
app.include_router(avatar.router)


os.makedirs("static/avatars", exist_ok=True)
@app.get("/")
def root():
    return {"message": "Whisper Space API"}
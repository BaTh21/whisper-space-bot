from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routers import auth, users, chats, diaries, websockets, friends, groups
from app.models import base
from app.core.database import engine

base.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Whisper Space",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(diaries.router, prefix="/api/v1/diaries", tags=["diaries"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])
app.include_router(friends.router, prefix="/api/v1/friends", tags=["friends"]) 
app.include_router(websockets.router, prefix="/api/v1", tags=["websockets"])
app.include_router(groups.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Whisper Space API"}
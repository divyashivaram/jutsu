import hashlib
import json
import secrets
import sqlite3
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from jutsu_master.db import connect, init_db

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
DEFAULT_DB = Path(__file__).resolve().parents[2] / "data" / "jutsu.db"

RANKS = ("academy", "genin", "chunin", "jonin", "kage")


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    username: str
    token: str


class Progress(BaseModel):
    xp: int = Field(default=0, ge=0)
    rank: str = Field(default="academy", pattern=f"^({'|'.join(RANKS)})$")
    seals: dict[str, Any] = Field(default_factory=dict)
    jutsus: dict[str, Any] = Field(default_factory=dict)


class LeaderboardRow(BaseModel):
    username: str
    xp: int
    rank: str


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 100_000).hex()


def create_app(db_path: Path = DEFAULT_DB) -> FastAPI:
    init_db(db_path)
    app = FastAPI(title="Jutsu Master")

    def current_user(authorization: Annotated[str | None, Header()] = None) -> sqlite3.Row:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token")
        token = authorization.removeprefix("Bearer ")
        with connect(db_path) as conn:
            row = conn.execute("SELECT * FROM users WHERE token = ?", (token,)).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        assert isinstance(row, sqlite3.Row)
        return row

    User = Annotated[sqlite3.Row, Depends(current_user)]

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/register", status_code=201, response_model=AuthResponse)
    def register(creds: Credentials) -> AuthResponse:
        salt = secrets.token_hex(16)
        token = secrets.token_hex(32)
        with connect(db_path) as conn:
            try:
                cur = conn.execute(
                    "INSERT INTO users (username, password_hash, salt, token) VALUES (?, ?, ?, ?)",
                    (creds.username, _hash_password(creds.password, salt), salt, token),
                )
            except sqlite3.IntegrityError:
                raise HTTPException(status_code=409, detail="Username already taken") from None
            conn.execute("INSERT INTO progress (user_id) VALUES (?)", (cur.lastrowid,))
        return AuthResponse(username=creds.username, token=token)

    @app.post("/api/login", response_model=AuthResponse)
    def login(creds: Credentials) -> AuthResponse:
        with connect(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?", (creds.username,)
            ).fetchone()
            if row is None or not secrets.compare_digest(
                row["password_hash"], _hash_password(creds.password, row["salt"])
            ):
                raise HTTPException(status_code=401, detail="Invalid username or password")
            token = secrets.token_hex(32)
            conn.execute("UPDATE users SET token = ? WHERE id = ?", (token, row["id"]))
        return AuthResponse(username=creds.username, token=token)

    @app.get("/api/me")
    def me(user: User) -> dict[str, str]:
        return {"username": user["username"]}

    @app.get("/api/progress", response_model=Progress)
    def get_progress(user: User) -> Progress:
        with connect(db_path) as conn:
            row = conn.execute(
                "SELECT xp, rank, data FROM progress WHERE user_id = ?", (user["id"],)
            ).fetchone()
        data = json.loads(row["data"])
        return Progress(
            xp=row["xp"],
            rank=row["rank"],
            seals=data.get("seals", {}),
            jutsus=data.get("jutsus", {}),
        )

    @app.put("/api/progress", response_model=Progress)
    def put_progress(progress: Progress, user: User) -> Progress:
        data = json.dumps({"seals": progress.seals, "jutsus": progress.jutsus})
        with connect(db_path) as conn:
            conn.execute(
                "UPDATE progress SET xp = ?, rank = ?, data = ?, updated_at = datetime('now') "
                "WHERE user_id = ?",
                (progress.xp, progress.rank, data, user["id"]),
            )
        return progress

    @app.get("/api/leaderboard", response_model=list[LeaderboardRow])
    def leaderboard() -> list[LeaderboardRow]:
        with connect(db_path) as conn:
            rows = conn.execute(
                "SELECT u.username, p.xp, p.rank FROM progress p "
                "JOIN users u ON u.id = p.user_id ORDER BY p.xp DESC, u.username LIMIT 20"
            ).fetchall()
        return [LeaderboardRow(username=r["username"], xp=r["xp"], rank=r["rank"]) for r in rows]

    if FRONTEND_DIR.is_dir():
        app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

    return app

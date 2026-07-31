"""
Run from project root:
    python -m server.seed
"""
import asyncio

from dotenv import load_dotenv

load_dotenv()

from server.auth import hash_password
from server.database import AsyncSessionLocal, create_tables
from server.models import User
from sqlalchemy import select

USERS = [
    {"display_name": "Liem",    "email": "liem@clubvegaming.com",    "password": "Clubv@482"},
    {"display_name": "Nghia",   "email": "nghia@clubvegaming.com",   "password": "Clubv@716"},
    {"display_name": "Dong",    "email": "dong@clubvegaming.com",    "password": "Clubv@953"},
    {"display_name": "Noah",    "email": "noah@clubvegaming.com",    "password": "Clubv@241"},
    {"display_name": "Vinh",    "email": "vinh@clubvegaming.com",    "password": "Clubv@867"},
    {"display_name": "Hau",     "email": "hau@clubvegaming.com",     "password": "Clubv@394"},
    {"display_name": "Tan",     "email": "tan@clubvegaming.com",     "password": "Clubv@528"},
    {"display_name": "Linh",    "email": "linh@clubvegaming.com",    "password": "Clubv@173"},
    {"display_name": "Nghiait", "email": "nghiait@clubvegaming.com", "password": "Clubv@649"},
    {"display_name": "Huy",     "email": "huy@clubvegaming.com",     "password": "Clubv@835"},
]


async def main() -> None:
    await create_tables()
    async with AsyncSessionLocal() as db:
        for u in USERS:
            result = await db.execute(
                select(User).where(User.display_name == u["display_name"])
            )
            if result.scalar_one_or_none():
                print(f"  skip   {u['display_name']:<12} (already exists)")
                continue
            db.add(User(
                display_name=u["display_name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
            ))
            print(f"  added  {u['display_name']:<12}  password: {u['password']}")
        await db.commit()
    print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(main())

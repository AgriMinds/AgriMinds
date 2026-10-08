"""Test fixtures.

Two expensive things are built once per session: a tiny real model (trained on synthetic data
for two epochs) and a PostgreSQL test database. Each test then runs inside a transaction that is
rolled back, so tests share the schema but never share rows.

PostgreSQL is used rather than SQLite because the application relies on native enum types and
row-value ``IN`` comparisons; testing on a different dialect would prove less than it appears to.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pytest
import pytest_asyncio
from ai_drews.config import DataPaths, PipelineConfig
from ai_drews.data.io import build_dataset
from ai_drews.features.fields import build_features
from ai_drews.training.drought import train_drought
from ai_drews.training.enso import train_enso
from ai_drews.training.maps import render_risk_maps
from fastapi.testclient import TestClient
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from agriminds_api.core.config import Settings
from agriminds_api.core.security import hash_password, normalise_phone
from agriminds_api.db.models import Base, Crop, Farm, Locale, User, UserRole, Woreda
from agriminds_api.db.seed import seed_geography
from agriminds_api.main import create_app

TEST_CFG = PipelineConfig(
    start="1994-01-01",
    end="2011-12-01",
    grid=(8, 8),
    train_end="2007-12-01",
    val_end="2009-12-01",
    epochs=2,
    patience=1,
)

TEST_PASSWORD = "test-password-12345"
JWT_SECRET = "test-only-secret-not-used-anywhere-else"


def _test_database_url() -> str:
    """The configured database with a ``_test`` suffix, unless one is given explicitly."""
    if explicit := os.environ.get("AGRIMINDS_TEST_DATABASE_URL"):
        return explicit
    base = os.environ.get(
        "AGRIMINDS_DATABASE_URL", "postgresql+asyncpg://agriminds:agriminds@localhost:5432/agriminds"
    )
    parts = urlsplit(base)
    return urlunsplit(parts._replace(path=f"{parts.path.rstrip('/')}_test"))


TEST_DATABASE_URL = _test_database_url()


# ------------------------------------------------------------------ model artifacts
@pytest.fixture(scope="session")
def artifacts_dir(tmp_path_factory) -> DataPaths:
    paths = DataPaths(tmp_path_factory.mktemp("data")).ensure()
    build_dataset(paths, TEST_CFG)
    build_features(paths, TEST_CFG)
    train_enso(paths, TEST_CFG, plot=False)
    train_drought(paths, TEST_CFG, data_source="synthetic")
    render_risk_maps(paths, TEST_CFG, plot=False)

    # The surveyed catchment outline travels with the artifacts, so the tests exercise the
    # boundary-aware grid rather than silently falling back to a bounding box.
    survey = BACKEND_ROOT.parent / "data/geo/choke_watershed.geojson"
    if survey.exists():
        paths.watershed_geojson.parent.mkdir(parents=True, exist_ok=True)
        paths.watershed_geojson.write_bytes(survey.read_bytes())
    return paths


# ------------------------------------------------------------------ database
@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Create the test database if needed, build the schema, and drop it all at the end."""
    admin_url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    db_name = TEST_DATABASE_URL.rsplit("/", 1)[1]
    admin = create_async_engine(admin_url, isolation_level="AUTOCOMMIT", poolclass=NullPool)
    try:
        async with admin.connect() as conn:
            exists = await conn.scalar(
                sa_text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": db_name}
            )
            if not exists:
                await conn.execute(sa_text(f'CREATE DATABASE "{db_name}"'))
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"PostgreSQL is not reachable for tests: {exc.__class__.__name__}")
    finally:
        await admin.dispose()

    # Build the schema with Alembic rather than metadata.create_all, so the tests exercise the
    # migrations that production actually runs -- including the analytics views and the read-only
    # role, which exist only there. Alembic's env.py opens its own event loop, so it runs in a
    # subprocess rather than inside pytest-asyncio's.
    _run_migrations(TEST_DATABASE_URL)

    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    yield engine
    await engine.dispose()


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _run_migrations(url: str) -> None:
    import subprocess
    import sys

    env = {**os.environ, "AGRIMINDS_DATABASE_URL": url}
    for argv in (["downgrade", "base"], ["upgrade", "head"]):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *argv],
            cwd=BACKEND_ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            pytest.fail(f"alembic {' '.join(argv)} failed:\n{result.stdout}\n{result.stderr}")


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncIterator[AsyncSession]:
    """A committing session that fixtures use to write rows.

    Isolation comes from truncation (see ``_clean_tables``) rather than an enclosing transaction,
    because ``TestClient`` drives the application on its own event loop: one asyncpg connection
    shared across two loops deadlocks.
    """
    session = AsyncSession(bind=db_engine, expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(db_engine) -> AsyncIterator[None]:
    """Empty every table after each test so no test can see another's rows."""
    yield
    tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
    async with db_engine.begin() as conn:
        await conn.execute(sa_text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


# ------------------------------------------------------------------ application
def _settings(data_dir, **overrides) -> Settings:
    base = dict(
        env="test",
        data_dir=data_dir,
        redis_url=None,
        api_keys=[],
        database_url=TEST_DATABASE_URL,
        jwt_secret=JWT_SECRET,
        _env_file=None,
    )
    base.update(overrides)
    return Settings(**base)


def _client(settings: Settings) -> TestClient:
    """The application opens its own pool against the test database, exactly as it does live."""
    return TestClient(create_app(settings))


@pytest.fixture
def client(artifacts_dir, db_engine) -> TestClient:
    with _client(_settings(artifacts_dir.root)) as c:
        yield c


@pytest.fixture
def auth_client(artifacts_dir, db_engine) -> TestClient:
    """A client whose API requires the service key for forecast endpoints."""
    with _client(_settings(artifacts_dir.root, api_keys=["secret-key"])) as c:
        yield c


@pytest.fixture
def empty_client(tmp_path, db_engine) -> TestClient:
    """No weights, no precomputed raster -> the model is unavailable."""
    with _client(_settings(tmp_path / "nothing")) as c:
        yield c


@pytest.fixture
def precomputed_client(artifacts_dir, tmp_path, db_engine) -> TestClient:
    """Only outputs/latest_risk.npz present -> degraded mode."""
    paths = DataPaths(tmp_path / "pre").ensure()
    (paths.outputs / "latest_risk.npz").write_bytes(artifacts_dir.latest_risk_npz.read_bytes())
    with _client(_settings(paths.root)) as c:
        yield c


# ------------------------------------------------------------------ data factories
@pytest_asyncio.fixture
async def woredas(db_session) -> dict[str, Woreda]:
    places = await seed_geography(db_session)
    await db_session.commit()
    return places


@pytest_asyncio.fixture
async def make_user(db_session, woredas):
    """Create an account. Returns the User; sign in with ``TEST_PASSWORD``."""
    hashed = hash_password(TEST_PASSWORD)

    async def _make(
        role: UserRole = UserRole.FARMER,
        *,
        email: str | None = None,
        phone: str | None = None,
        full_name: str = "Test Person",
        woreda_code: str | None = None,
        is_active: bool = True,
        locale: Locale = Locale.EN,
    ) -> User:
        if email is None and phone is None:
            suffix = uuid.uuid4().hex[:6]
            if role is UserRole.FARMER:
                phone = normalise_phone(f"09{int(suffix, 16) % 100000000:08d}")
            else:
                email = f"{role.value}-{suffix}@example.et"
        user = User(
            email=email,
            phone=phone,
            full_name=full_name,
            hashed_password=hashed,
            role=role,
            locale=locale,
            is_active=is_active,
            woreda_id=woredas[woreda_code].id if woreda_code else None,
        )
        db_session.add(user)
        await db_session.commit()
        return user

    return _make


@pytest_asyncio.fixture
async def make_farm(db_session, woredas):
    async def _make(
        owner: User,
        *,
        row: int = 4,
        col: int = 4,
        latitude: float = 10.75,
        longitude: float = 38.05,
        area: float = 1.5,
        crop: Crop = Crop.TEF,
        woreda_code: str = "SNN",
        name: str = "Test plot",
    ) -> Farm:
        farm = Farm(
            owner_id=owner.id,
            woreda_id=woredas[woreda_code].id,
            name=name,
            latitude=latitude,
            longitude=longitude,
            grid_row=row,
            grid_col=col,
            area_hectares=area,
            primary_crop=crop,
        )
        db_session.add(farm)
        await db_session.commit()
        return farm

    return _make


@pytest_asyncio.fixture
async def minister_headers(make_user, sign_in):
    """Authorization header for a ministry account."""
    user = await make_user(UserRole.MINISTER, email="inventory-minister@example.et")
    return sign_in(user.email)["headers"]


@pytest_asyncio.fixture
async def farmer_headers(make_user, sign_in):
    """Authorization header for a farmer account."""
    user = await make_user(UserRole.FARMER, phone="+251911909090")
    return sign_in(user.phone)["headers"]


@pytest.fixture
def test_password() -> str:
    """The password every account created by ``make_user`` is given."""
    return TEST_PASSWORD


@pytest.fixture
def sign_in(client):
    """Sign in and return the Authorization header plus the raw token payload."""

    def _sign_in(identifier: str, password: str = TEST_PASSWORD, c: TestClient | None = None) -> dict:
        target = c or client
        response = target.post("/api/v1/auth/login", json={"identifier": identifier, "password": password})
        assert response.status_code == 200, response.text
        body = response.json()
        body["headers"] = {"Authorization": f"Bearer {body['access_token']}"}
        return body

    return _sign_in

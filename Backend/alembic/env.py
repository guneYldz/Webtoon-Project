import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# 1. Ensure Backend/ directory is in sys.path so 'import models' works cleanly
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# 2. Load .env file from Backend/.env or root ../.env
try:
    from dotenv import load_dotenv
    env_backend = os.path.join(backend_dir, ".env")
    env_root = os.path.abspath(os.path.join(backend_dir, "..", ".env"))
    if os.path.exists(env_backend):
        load_dotenv(env_backend)
    if os.path.exists(env_root):
        load_dotenv(env_root)
except ImportError:
    pass

# 3. Import models for target metadata
import models

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 4. Resolve DB connection string from environment
db_url = os.getenv("DB_CONNECTION") or os.getenv("DATABASE_URL")
if db_url:
    # Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    config.set_main_option("sqlalchemy.url", db_url)

# Model metadata for autogenerate
target_metadata = models.Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    configuration = config.get_section(config.config_ini_section, {})
    if db_url:
        configuration["sqlalchemy.url"] = db_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

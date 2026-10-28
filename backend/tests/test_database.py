from datetime import datetime

from qdrant_client import QdrantClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.database.connection import AuditLog, Base, UserSession
from backend.database.vector_store import COLLECTION_NAME, VectorMemoryStore, VECTOR_SIZE


def test_sqlite_session_inserts_user_session_and_audit_log() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    try:
        Base.metadata.create_all(engine)
        with Session(engine) as session:
            user_session = UserSession(id="session-123")
            audit_log = AuditLog(
                prompt_hash="sha256:example",
                pii_tokens_masked=2,
                model_used="test-model",
            )
            session.add_all([user_session, audit_log])
            session.commit()

            stored_session = session.get(UserSession, "session-123")
            stored_log = session.get(AuditLog, audit_log.id)

            assert stored_session is not None
            assert isinstance(stored_session.created_at, datetime)
            assert stored_log is not None
            assert stored_log.prompt_hash == "sha256:example"
            assert stored_log.pii_tokens_masked == 2
            assert stored_log.model_used == "test-model"
            assert isinstance(stored_log.timestamp, datetime)
    finally:
        engine.dispose()


def test_qdrant_vector_memory_is_saved_and_searched_by_user() -> None:
    client = QdrantClient(location=":memory:")
    try:
        store = VectorMemoryStore(client=client)
        vector = [1.0] + [0.0] * (VECTOR_SIZE - 1)
        point_id = store.save_memory(
            user_id="user-123",
            memory_text="The user prefers concise answers.",
            vector=vector,
        )
        store.save_memory(
            user_id="another-user",
            memory_text="Private memory for another user.",
            vector=vector,
        )

        results = store.search_memory(user_id="user-123", query_vector=vector)

        assert client.collection_exists(COLLECTION_NAME)
        assert len(results) == 1
        assert results[0].id == point_id
        assert results[0].payload == {
            "user_id": "user-123",
            "memory_text": "The user prefers concise answers.",
        }
    finally:
        client.close()

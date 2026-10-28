from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http import models

from backend.config.settings import get_settings

COLLECTION_NAME = "sayze_memory"
VECTOR_SIZE = 1536


class VectorMemoryStore:
    def __init__(self, client: QdrantClient | None = None) -> None:
        if client is None:
            settings = get_settings()
            client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
            )
        self.client = client
        if not self.client.collection_exists(COLLECTION_NAME):
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=VECTOR_SIZE,
                    distance=models.Distance.COSINE,
                ),
            )

    @staticmethod
    def _validate_vector(vector: list[float]) -> None:
        if len(vector) != VECTOR_SIZE:
            raise ValueError(
                f"Vectors for {COLLECTION_NAME} must contain {VECTOR_SIZE} values"
            )

    def save_memory(
        self,
        user_id: str,
        memory_text: str,
        vector: list[float],
    ) -> str:
        self._validate_vector(vector)
        point_id = str(uuid4())
        self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"user_id": user_id, "memory_text": memory_text},
                )
            ],
            wait=True,
        )
        return point_id

    def search_memory(
        self,
        user_id: str,
        query_vector: list[float],
        limit: int = 3,
    ) -> list[models.ScoredPoint]:
        self._validate_vector(query_vector)
        if limit < 1:
            raise ValueError("limit must be at least 1")

        response = self.client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="user_id",
                        match=models.MatchValue(value=user_id),
                    )
                ]
            ),
            limit=limit,
            with_payload=True,
        )
        return response.points


def create_vector_store() -> QdrantClient:
    """Create a raw Qdrant client for callers that need direct collection access."""
    settings = get_settings()
    return QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)

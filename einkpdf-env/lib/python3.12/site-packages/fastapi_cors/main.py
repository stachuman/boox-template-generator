from datetime import datetime
from typing import Union

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class CORS:
    def __init__(self, app: FastAPI, include_health_check: bool = True):
        from fastapi_cors.env import ALLOW_ORIGINS
        from fastapi_cors.env import ALLOWED_CREDENTIALS
        from fastapi_cors.env import ALLOWED_HEADERS
        from fastapi_cors.env import ALLOWED_METHODS

        app.add_middleware(
            CORSMiddleware,
            allow_origins=ALLOW_ORIGINS,
            allow_credentials=ALLOWED_CREDENTIALS,
            allow_methods=ALLOWED_METHODS,
            allow_headers=ALLOWED_HEADERS,
        )

        if include_health_check:
            START_TIME = datetime.utcnow().isoformat()
            from fastapi_cors.env import HOST
            from fastapi_cors.env import LOG_LEVEL
            from fastapi_cors.env import PORT

            class PydanticHealthCheck(BaseModel):
                status: str
                details: dict[str, Union[str, int, dict[str, str]]]
                env: dict[str, Union[str, int, list[str]]]

            @app.get("/health")
            def health_check() -> JSONResponse:
                health_check = PydanticHealthCheck(
                    status="pass",
                    details={"uptime": {"time": START_TIME}},
                    env={
                        "HOST": HOST,
                        "PORT": PORT,
                        "LOG_LEVEL": LOG_LEVEL,
                        "ALLOW_ORIGINS": ALLOW_ORIGINS,
                        "ALLOWED_CREDENTIALS": ALLOWED_CREDENTIALS,
                        "ALLOWED_METHODS": ALLOWED_METHODS,
                        "ALLOWED_HEADERS": ALLOWED_HEADERS,
                    },
                )
                json_compatible_health_check = jsonable_encoder(health_check)
                return JSONResponse(content=json_compatible_health_check)

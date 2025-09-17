from environs import Env

# move this to a file such that every import has the env loaded
env = Env()
env.read_env()  # read .env file, if it exists


# where the requests come from
ALLOW_ORIGINS = env.list(
    name="ALLOW_ORIGINS",
    subcast=str,
    default=[
        "http://localhost",  # docs viewing by user
        "http://localhost:3000",  # frontend default
    ],
)

ALLOWED_CREDENTIALS = env.bool(name="ALLOWED_CREDENTIALS", default=True)

ALLOWED_METHODS = env.list(
    name="ALLOWED_METHODS",
    subcast=str,
    default=["*"],
)

ALLOWED_HEADERS = env.list(
    name="ALLOWED_HEADERS",
    subcast=str,
    default=["Access-Control-Allow-Origin"],
)

HOST = env.str(name="HOST", default="0.0.0.0")
PORT = env.int(name="PORT", default=8000)
LOG_LEVEL = env.str(name="LOG_LEVEL", default="info")

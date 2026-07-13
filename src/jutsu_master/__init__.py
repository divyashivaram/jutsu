def main() -> None:
    import uvicorn

    from jutsu_master.app import create_app

    uvicorn.run(create_app(), host="127.0.0.1", port=8110)

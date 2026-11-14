from ninja import Schema


class ErrorSchema(Schema):
    err: str


__all__ = ("ErrorSchema",)

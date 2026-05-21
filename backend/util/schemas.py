from typing import Generic, TypeVar

from ninja import Schema

T = TypeVar("T")


class ValueWrapped(Schema, Generic[T]):
    value: T

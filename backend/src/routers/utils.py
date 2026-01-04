"""
Утилиты для роутеров FastAPI
"""
from functools import wraps
from fastapi import APIRouter
from typing import Callable, Any


def both_slashes(router: APIRouter, path: str, **kwargs):
    """
    Декоратор для создания роута, который работает как с trailing slash, так и без него.
    
    Args:
        router: APIRouter instance
        path: Путь для роута
        **kwargs: Дополнительные параметры для роута
    
    Returns:
        Декоратор функции
    """
    def decorator(func: Callable) -> Callable:
        # Создаем роут с trailing slash
        router.add_api_route(path, func, **kwargs)
        
        # Создаем роут без trailing slash (только если path не пустой)
        if path and path != "/":
            path_without_slash = path.rstrip("/")
            if path_without_slash != path:
                router.add_api_route(path_without_slash, func, **kwargs)
        
        return func
    return decorator


def get_both(router: APIRouter, path: str, **kwargs):
    """Создает GET роут с поддержкой trailing slash и без него"""
    return both_slashes(router, path, methods=["GET"], **kwargs)


def post_both(router: APIRouter, path: str, **kwargs):
    """Создает POST роут с поддержкой trailing slash и без него"""
    return both_slashes(router, path, methods=["POST"], **kwargs)


def put_both(router: APIRouter, path: str, **kwargs):
    """Создает PUT роут с поддержкой trailing slash и без него"""
    return both_slashes(router, path, methods=["PUT"], **kwargs)


def delete_both(router: APIRouter, path: str, **kwargs):
    """Создает DELETE роут с поддержкой trailing slash и без него"""
    return both_slashes(router, path, methods=["DELETE"], **kwargs)

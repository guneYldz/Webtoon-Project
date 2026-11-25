from collections import OrderedDict
import copy
import threading
import time
from typing import Any

try:
    from cachetools import TTLCache as _BaseTTLCache
except ImportError:
    class _BaseTTLCache(OrderedDict):
        """Stdlib fallback matching cachetools.TTLCache when container deps are absent."""

        def __init__(self, maxsize: int, ttl: float):
            super().__init__()
            self.maxsize = max(1, int(maxsize))
            self.ttl = float(ttl)

        def _purge_expired(self) -> None:
            now = time.monotonic()
            expired = [k for k, (exp, _val) in self.items() if exp <= now]
            for k in expired:
                super().pop(k, None)

        def __getitem__(self, key: Any) -> Any:
            self._purge_expired()
            exp, val = super().__getitem__(key)
            if exp <= time.monotonic():
                super().pop(key, None)
                raise KeyError(key)
            return val

        def __setitem__(self, key: Any, value: Any) -> None:
            self._purge_expired()
            if key in self:
                super().pop(key, None)
            elif len(self) >= self.maxsize:
                self.popitem(last=False)
            super().__setitem__(key, (time.monotonic() + self.ttl, value))

        def __contains__(self, key: object) -> bool:
            self._purge_expired()
            return super().__contains__(key)

        def get(self, key: Any, default: Any = None) -> Any:
            try:
                return self[key]
            except KeyError:
                return default


class ThreadSafeTTLCache:
    """Thread-safe wrapper around TTLCache preventing concurrent mutation races."""

    def __init__(self, maxsize: int = 16, ttl: float = 45.0):
        self._cache = _BaseTTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = threading.RLock()

    def get(self, key: Any, default: Any = None) -> Any:
        with self._lock:
            val = self._cache.get(key, None)
            if val is None:
                return default
            return copy.deepcopy(val)

    def set(self, key: Any, value: Any) -> None:
        with self._lock:
            self._cache[key] = copy.deepcopy(value)

    def delete(self, key: Any) -> None:
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def __contains__(self, key: Any) -> bool:
        with self._lock:
            return key in self._cache

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)


vitrin_cache = ThreadSafeTTLCache(maxsize=16, ttl=45.0)
admin_stats_cache = ThreadSafeTTLCache(maxsize=16, ttl=45.0)


def invalidate_vitrin_cache() -> None:
    vitrin_cache.clear()


def invalidate_admin_stats_cache() -> None:
    admin_stats_cache.clear()


def invalidate_content_caches() -> None:
    vitrin_cache.clear()
    admin_stats_cache.clear()

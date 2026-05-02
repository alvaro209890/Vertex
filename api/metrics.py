import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict

@dataclass
class MetricsStore:
    # timestamps of requests
    request_timestamps: list[float] = field(default_factory=list)
    # session_id -> token count
    session_tokens: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    lock: threading.Lock = field(default_factory=threading.Lock)

    def record_request(self):
        now = time.time()
        with self.lock:
            self.request_timestamps.append(now)
            # cleanup older than 60 seconds
            self.request_timestamps = [ts for ts in self.request_timestamps if now - ts < 60]

    def record_tokens(self, session_id: str, tokens: int):
        if not session_id or not tokens:
            return
        with self.lock:
            self.session_tokens[session_id] += tokens

    def get_metrics(self) -> dict:
        now = time.time()
        with self.lock:
            # clean up stale timestamps before reporting
            self.request_timestamps = [ts for ts in self.request_timestamps if now - ts < 60]
            rpm = len(self.request_timestamps)
            # copy dict to avoid mutation during iteration
            tokens = dict(self.session_tokens)
            
        return {
            "requests_per_minute": rpm,
            "session_tokens": tokens
        }

# Global singleton
metrics_store = MetricsStore()

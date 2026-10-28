"""Estado de la transcripcion sobre la linea temporal original del audio."""
import json
import sys
import time


class Progress:
    def __init__(self, output=None, clock=time.monotonic):
        self.output = output or sys.stderr
        self.clock = clock
        self.started = clock()
        self.processed = 0.0

    def send(self, phase, processed=0, duration=0):
        self.processed = max(self.processed, float(processed))
        elapsed = max(0, self.clock() - self.started)
        percent = min(99.5, 100 * self.processed / duration) if duration > 0 else None
        eta = elapsed * max(0, duration - self.processed) / self.processed if self.processed >= 15 else None
        if phase == 'complete':
            percent, eta = 100, 0
        payload = dict(phase=phase, percent=percent, processed=self.processed,
                       duration=duration, elapsed=round(elapsed, 1),
                       eta=round(eta) if eta is not None else None)
        self.output.write('VIDEOTECA_PROGRESS ' + json.dumps(payload) + '\n')
        self.output.flush()

import importlib.util
import io
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('progress', Path(__file__).parents[1] / 'transcription_progress.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProgressTest(unittest.TestCase):
    def test_progress_eta_and_completion(self):
        output = io.StringIO()
        times = iter([0, 10, 20, 30, 40])
        progress = module.Progress(output=output, clock=lambda: next(times))
        progress.send('loading')
        progress.send('transcribing', 25, 100)
        progress.send('transcribing', 10, 100)
        progress.send('complete', 100, 100)
        values = [json.loads(line.removeprefix('VIDEOTECA_PROGRESS ')) for line in output.getvalue().splitlines()]
        self.assertIsNone(values[0]['percent'])
        self.assertEqual(values[1]['percent'], 25)
        self.assertEqual(values[1]['eta'], 60)
        self.assertEqual(values[2]['percent'], 25)
        self.assertEqual(values[3]['percent'], 100)
        self.assertEqual(values[3]['eta'], 0)


if __name__ == '__main__':
    unittest.main()

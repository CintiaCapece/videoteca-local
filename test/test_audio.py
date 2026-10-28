"""Prueba de decodificacion sin modelos ni descargas de audio."""
import tempfile
import unittest
import wave
from pathlib import Path

from faster_whisper.audio import decode_audio


class AudioCompatibilityTest(unittest.TestCase):
    def test_decodes_pcm_with_installed_pyav(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / 'sample.wav'
            with wave.open(str(audio), 'wb') as target:
                target.setnchannels(1)
                target.setsampwidth(2)
                target.setframerate(16000)
                target.writeframes(b'\x00\x00' * 4000)
            decoded = decode_audio(str(audio), sampling_rate=16000)
            self.assertEqual(len(decoded), 4000)
            self.assertEqual(decoded.dtype.name, 'float32')


if __name__ == '__main__':
    unittest.main()

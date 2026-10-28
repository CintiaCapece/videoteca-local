"""Trabajador opcional. Lee el video; sólo escribe la caché de modelos."""
import json
import sys
from faster_whisper import WhisperModel

video, cache, device = sys.argv[1:4]
model = WhisperModel('small', device=device,
                     compute_type='int8_float16' if device == 'cuda' else 'int8',
                     cpu_threads=4, num_workers=1, download_root=cache)
segments, info = model.transcribe(video, beam_size=3, vad_filter=True,
                                  condition_on_previous_text=False)
lines = []
for segment in segments:
    seconds = int(segment.start)
    lines.append(f'[{seconds // 3600:02d}:{seconds // 60 % 60:02d}:{seconds % 60:02d}] {segment.text.strip()}')
print(json.dumps({'text': '\n'.join(lines), 'language': info.language,
                  'model': f'faster-whisper small / {device}'}, ensure_ascii=True))

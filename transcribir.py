"""Trabajador opcional. Lee el video; sólo escribe la caché de modelos."""
import json
import sys
from faster_whisper import WhisperModel
from transcription_progress import Progress

video, cache, device = sys.argv[1:4]
profile = sys.argv[4] if len(sys.argv) > 4 else 'balanced'
language = sys.argv[5] if len(sys.argv) > 5 else 'auto'
progress = Progress()
progress.send('loading')
model = WhisperModel('small', device=device,
                     compute_type='int8_float16' if device == 'cuda' else 'int8',
                     cpu_threads=8 if profile == 'fast' else 4,
                     num_workers=1, download_root=cache)
progress.send('preparing')
segments, info = model.transcribe(video, beam_size=1 if profile == 'fast' else 3,
                                  language=language if language in ('es', 'en') else None,
                                  vad_filter=True,
                                  condition_on_previous_text=False)
progress.send('transcribing', duration=info.duration)
lines = []
for segment in segments:
    seconds = int(segment.start)
    lines.append(f'[{seconds // 3600:02d}:{seconds // 60 % 60:02d}:{seconds % 60:02d}] {segment.text.strip()}')
    progress.send('transcribing', processed=segment.end, duration=info.duration)
progress.send('complete', processed=info.duration, duration=info.duration)
print(json.dumps({'text': '\n'.join(lines), 'language': info.language,
                  'model': f'faster-whisper small / {device} / {profile}'}, ensure_ascii=True))

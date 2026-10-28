import sys
from faster_whisper import WhisperModel

WhisperModel(sys.argv[1], device='cpu', compute_type='int8', download_root=sys.argv[2])
print('Modelo de transcripcion preparado.')

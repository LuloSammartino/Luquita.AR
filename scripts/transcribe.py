"""Transcripción en CPU; descarga el modelo una vez, sin API de IA externa."""
import json
import os
import sys
from faster_whisper import WhisperModel

model = WhisperModel(os.environ.get('WHISPER_MODEL', 'base'), device='cpu', compute_type='int8')
segments, _ = model.transcribe(sys.argv[1], language='es', vad_filter=True, beam_size=5,
    initial_prompt='Gastos en pesos argentinos, supermercado, nafta, alquiler, ingresos.')
print(json.dumps({'text': ' '.join(segment.text.strip() for segment in segments)}, ensure_ascii=False))

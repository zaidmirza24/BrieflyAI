"""
LLM analysis stage: turns a clean transcript into structured JSON insights.

Only the transcript text is ever sent to the LLM -- never the audio file.
Uses Google Gemini via the official google-genai SDK.

To swap LLM providers later, implement the same `analyze()` contract on a
new class and swap the instantiation in pipeline.py.
"""

import json
import re

from config import LLMConfig

INSIGHTS_SCHEMA = {
    "summary": None,
    "school_name": None,
    "student_participation": None,
    "tuition_status": None,
    "study_hours": {
        "current": None,
        "target": None,
        "unit": "hours_per_day",
        "mentioned": False,
    },
    "current_routine": None,
    "goals": [],
    "challenges": [],
    "mentor_advice": [],
    "mentee_commitments": [],
    "action_items": [],
    "important_points": [],
}

_BASE_SYSTEM_PROMPT = """You are analyzing a transcript of a mentor-mentee (or \
mentor-student/parent) phone call \
(the transcript may contain Hindi, Urdu, Hinglish/Urdulish, and/or English -- read it in \
whatever language/script it appears).

If the transcript has speaker labels (e.g. SPEAKER_00, SPEAKER_01), infer from \
the conversational content which speaker is the MENTOR (gives advice, asks \
guiding questions, sets expectations) and which is the MENTEE/STUDENT/PARENT \
(reports progress, describes routine/struggles, receives advice) and use that \
inference when writing your analysis. If there are no speaker labels, infer \
roles from context as best you can.

Respond with ONLY a single JSON object, no prose before or after, matching \
exactly this schema (keep these exact English key names regardless of what \
language you write the values in):

{
  "summary": "2-4 sentence overview of the conversation",
  "school_name": "the student's school name if mentioned, else null",
  "student_participation": "whether the student personally spoke on the call vs. only a parent/guardian speaking on their behalf, and how much the student participated; null if unclear",
  "tuition_status": "whether the student attends extra tuition/coaching classes outside school, and any details mentioned; null if not discussed",
  "study_hours": {
    "current": "current study/work hours mentioned, as a number, or null if none mentioned",
    "target": "a target/goal number of study hours mentioned, or null if none mentioned",
    "unit": "hours_per_day",
    "mentioned": "true if study hours were discussed at all, false otherwise"
  },
  "current_routine": "description of the mentee's current routine as discussed, or null if not discussed",
  "goals": ["list of goals mentioned"],
  "challenges": ["list of challenges/obstacles mentioned"],
  "mentor_advice": ["list of distinct pieces of advice the mentor gave"],
  "mentee_commitments": ["list of things the mentee committed to doing"],
  "action_items": ["concrete, actionable next steps, phrased imperatively"],
  "important_points": ["any other significant details discussed by the mentor, student, or parent -- e.g. family circumstances, attendance issues, exam results"]
}

Rules:
- Use information only from the transcript. Do not invent details.
- If a field has no relevant content, use JSON null (not an empty string) or an empty list ([]) as appropriate -- never omit a key.
- "unit" in study_hours is always the literal string "hours_per_day" unless a different unit was explicitly discussed.
- Keep list items concise (one idea per item).
"""

_LANGUAGE_INSTRUCTIONS = {
    "roman-urdu": (
        "Write every text value in the JSON (summary, study_hours, current_routine, "
        "and every list item) in Roman Urdu / Urdulish -- casual Urdu written in the "
        "Latin/English alphabet, the way people type it in WhatsApp messages "
        "(e.g. \"Aapko mehnat karni hai apni padhai ke liye\"). Do NOT write in "
        "English, and do NOT use Urdu/Arabic script or Devanagari -- Roman letters only."
    ),
    "roman-hindi": (
        "Write every text value in the JSON (summary, study_hours, current_routine, "
        "and every list item) in Roman Hindi / Hinglish -- casual Hindi written in the "
        "Latin/English alphabet, the way people type it in WhatsApp messages "
        "(e.g. \"Aapko mehnat karni hai apni padhai ke liye\"). Do NOT write in "
        "English, and do NOT use Devanagari script -- Roman letters only."
    ),
}


def build_system_prompt(insights_language: str) -> str:
    instruction = _LANGUAGE_INSTRUCTIONS.get((insights_language or "").lower())
    if not instruction:
        return _BASE_SYSTEM_PROMPT
    return _BASE_SYSTEM_PROMPT + "\nLanguage requirement:\n" + instruction + "\n"


class GeminiProvider:
    """Google Gemini analysis via the official google-genai SDK.

    Get a free API key at https://aistudio.google.com/apikey and set
    GEMINI_API_KEY in your .env file.
    """

    def __init__(self, cfg: LLMConfig):
        self.cfg = cfg

    def analyze(self, transcript: str) -> dict:
        if not self.cfg.api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Get a free key at "
                "https://aistudio.google.com/apikey and set it in your environment or a .env file."
            )

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.cfg.api_key)
        response = client.models.generate_content(
            model=self.cfg.model,
            contents=f"Transcript:\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=build_system_prompt(self.cfg.insights_language),
                temperature=self.cfg.temperature,
                max_output_tokens=self.cfg.max_tokens,
                response_mime_type="application/json",
            ),
        )
        return _parse_json_response(response.text)


def _parse_json_response(raw_text: str) -> dict:
    text = raw_text.strip()
    # Strip markdown code fences if the model added them despite instructions
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Fallback for models that add stray prose outside any code fence:
        # grab everything between the first '{' and the last '}' and retry.
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if not brace_match:
            raise ValueError(f"LLM did not return valid JSON. Raw response:\n{raw_text}")
        try:
            data = json.loads(brace_match.group(0))
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM did not return valid JSON. Raw response:\n{raw_text}") from e

    # Keep exactly the schema's keys (fill in anything missing, drop
    # anything extra the model hallucinated) and coerce obviously wrong
    # types back to the schema's shape so downstream code can rely on it.
    result = {}
    for key, default in INSIGHTS_SCHEMA.items():
        value = data.get(key, default)
        if key == "study_hours":
            value = _coerce_study_hours(value if isinstance(value, dict) else {})
        elif isinstance(default, list):
            if not isinstance(value, list):
                value = [value] if value else []
        elif isinstance(default, str) or default is None:
            # Plain string fields: empty/whitespace-only counts as "not mentioned".
            if value is None or (isinstance(value, str) and not value.strip()):
                value = None
            elif not isinstance(value, str):
                value = str(value)
        result[key] = value
    return result


def _coerce_study_hours(value: dict) -> dict:
    default = INSIGHTS_SCHEMA["study_hours"]

    def _num_or_none(v):
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return v
        return None

    return {
        "current": _num_or_none(value.get("current")),
        "target": _num_or_none(value.get("target")),
        "unit": value.get("unit") or default["unit"],
        "mentioned": bool(value.get("mentioned", False)),
    }


def get_provider(cfg: LLMConfig) -> GeminiProvider:
    return GeminiProvider(cfg)

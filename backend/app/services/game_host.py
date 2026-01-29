"""
AI Game Host - Gemini-powered game show host for Quizly

The Game Host provides:
- Witty, encouraging commentary during games
- Real-time explanations when students answer wrong
- Fun reactions to correct answers
- Post-game insights for teachers
"""

import os
import json
import random
from typing import Dict, Any, AsyncGenerator
from enum import Enum

import google.generativeai as genai

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class HostEvent(str, Enum):
    """Events the host can react to."""
    GAME_START = "game_start"
    QUESTION_START = "question_start"
    CORRECT_ANSWER = "correct_answer"
    WRONG_ANSWER = "wrong_answer"
    TIME_UP = "time_up"
    STREAK = "streak"  # Multiple correct in a row
    COMEBACK = "comeback"  # Was behind, now catching up
    GAME_END = "game_end"
    LEADERBOARD_UPDATE = "leaderboard_update"


# Host personality prompts
HOST_SYSTEM_PROMPT = """You are QUIZZY, an enthusiastic and witty AI game show host for an educational quiz game called Quizly.

Your personality:
- Encouraging and supportive, never mean
- Uses fun expressions and light humor
- Celebrates learning, not just winning
- Keeps energy high but not annoying
- Speaks in short, punchy sentences (1-2 sentences max for reactions)
- Uses occasional emojis but not excessively

You're hosting a live quiz game for students. Keep responses SHORT and FUN.
"""

REACTION_PROMPTS = {
    HostEvent.GAME_START: """The game is starting! Players: {player_count}. Quiz: "{quiz_title}".
Give an exciting 1-sentence welcome to get everyone hyped!""",

    HostEvent.QUESTION_START: """Question {question_num} of {total}: "{question_text}"
Give a quick 1-sentence teaser or hint (without giving away the answer). Keep it fun!""",

    HostEvent.CORRECT_ANSWER: """{player_name} got it RIGHT! They answered "{answer}" in {time_taken:.1f} seconds.
{streak_info}
Give them a fun, short celebration (1 sentence)!""",

    HostEvent.WRONG_ANSWER: """{player_name} answered "{their_answer}" but the correct answer was "{correct_answer}".
Question was: "{question_text}"

Give a SHORT encouraging response (1 sentence) + brief explanation of why the correct answer is right (1-2 sentences). Be supportive!""",

    HostEvent.TIME_UP: """Time's up on this question! The answer was "{correct_answer}".
Question: "{question_text}"
Give a quick 1-sentence reaction.""",

    HostEvent.GAME_END: """Game Over!
Winner: {winner_name} with {winner_score} points!
Total players: {player_count}
Average score: {avg_score}

Give a fun closing statement celebrating everyone (2-3 sentences). Mention the winner but also encourage others!""",

    HostEvent.STREAK: """{player_name} is on a {streak_count}-answer streak! 🔥
Give them a hyped-up 1-sentence reaction!""",
}


class GameHost:
    """AI Game Show Host powered by Gemini."""

    def __init__(self):
        self.model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=HOST_SYSTEM_PROMPT
        )
        # Track streaks per player
        self.player_streaks: Dict[str, int] = {}

    async def react(
        self,
        event: HostEvent,
        context: Dict[str, Any]
    ) -> str:
        """
        Get the host's reaction to a game event.

        Args:
            event: The type of event
            context: Event-specific context data

        Returns:
            Host's reaction text
        """
        prompt_template = REACTION_PROMPTS.get(event)
        if not prompt_template:
            return ""

        try:
            # Add streak info for correct answers
            if event == HostEvent.CORRECT_ANSWER:
                player_id = context.get("player_id", "")
                self.player_streaks[player_id] = self.player_streaks.get(player_id, 0) + 1
                streak = self.player_streaks[player_id]
                if streak >= 3:
                    context["streak_info"] = f"That's {streak} in a row!"
                else:
                    context["streak_info"] = ""
            elif event == HostEvent.WRONG_ANSWER:
                player_id = context.get("player_id", "")
                self.player_streaks[player_id] = 0

            prompt = prompt_template.format(**context)

            response = await self.model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": 0.9,
                    "max_output_tokens": 150,
                }
            )

            return response.text.strip()

        except Exception as e:
            print(f"GameHost error: {e}")
            # Fallback reactions
            return self._fallback_reaction(event, context)

    async def react_stream(
        self,
        event: HostEvent,
        context: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """
        Stream the host's reaction for real-time feel.

        Yields chunks of text as they're generated.
        """
        prompt_template = REACTION_PROMPTS.get(event)
        if not prompt_template:
            return

        try:
            prompt = prompt_template.format(**context)

            response = await self.model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": 0.9,
                    "max_output_tokens": 150,
                },
                stream=True
            )

            async for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            print(f"GameHost stream error: {e}")
            yield self._fallback_reaction(event, context)

    async def explain_answer(
        self,
        question_text: str,
        correct_answer: str,
        student_answer: str,
        options: Dict[str, str]
    ) -> str:
        """
        Provide a helpful explanation for why an answer is correct.

        This is shown to students who got it wrong.
        """
        prompt = f"""A student answered a quiz question incorrectly. Help them understand!

Question: {question_text}
Options: {json.dumps(options)}
Student's answer: {student_answer}
Correct answer: {correct_answer}

Give a brief, encouraging explanation (2-3 sentences):
1. Acknowledge their thinking (why they might have chosen their answer)
2. Explain why the correct answer is right
3. End with an encouraging note

Keep it simple and supportive!"""

        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 200,
                }
            )
            return response.text.strip()
        except Exception as e:
            print(f"Explain error: {e}")
            return f"The correct answer was {correct_answer}. Keep learning, you've got this! 💪"

    async def generate_insights(
        self,
        quiz_title: str,
        questions: list,
        responses: list,
        player_count: int
    ) -> Dict[str, Any]:
        """
        Generate teacher insights after a game.

        Analyzes student responses to identify:
        - Common misconceptions
        - Topics that need review
        - Standout performers
        """
        prompt = f"""Analyze this quiz game results for a teacher:

Quiz: {quiz_title}
Players: {player_count}

Questions and Responses:
{json.dumps(questions, indent=2)}

Student Response Summary:
{json.dumps(responses, indent=2)}

Provide a JSON analysis with:
{{
    "overall_performance": "Brief 1-sentence summary",
    "class_strengths": ["Topics students understood well"],
    "areas_for_review": ["Topics that need more practice"],
    "common_misconceptions": [
        {{"topic": "...", "misconception": "...", "suggestion": "..."}}
    ],
    "engagement_notes": "How engaged were students (based on response times, completion)",
    "next_steps": ["2-3 actionable recommendations for the teacher"]
}}"""

        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": 0.5,
                    "max_output_tokens": 500,
                    "response_mime_type": "application/json"
                }
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"Insights error: {e}")
            return {
                "overall_performance": "Game completed successfully!",
                "class_strengths": [],
                "areas_for_review": [],
                "common_misconceptions": [],
                "engagement_notes": "Good participation",
                "next_steps": ["Review missed questions with the class"]
            }

    def _fallback_reaction(self, event: HostEvent, context: Dict[str, Any]) -> str:
        """Fallback reactions when AI is unavailable."""
        fallbacks = {
            HostEvent.GAME_START: [
                "Let's gooo! 🎮",
                "Game time! Good luck everyone!",
                "Ready to learn and have fun? Let's do this!"
            ],
            HostEvent.CORRECT_ANSWER: [
                "Nailed it! ✨",
                "Boom! That's right!",
                "You're on fire! 🔥"
            ],
            HostEvent.WRONG_ANSWER: [
                "Not quite, but you're learning! The answer was {correct_answer}.",
                "Close! The correct answer was {correct_answer}. Keep going!",
                "That's okay! {correct_answer} was the one. You'll get the next one!"
            ],
            HostEvent.TIME_UP: [
                "Time's up! The answer was {correct_answer}.",
            ],
            HostEvent.GAME_END: [
                "Great game everyone! 🎉",
                "What an amazing round! Well played!",
            ],
        }

        options = fallbacks.get(event, [""])
        reaction = random.choice(options)

        try:
            return reaction.format(**context)
        except:  # noqa: E722
            return reaction

    def reset_game(self):
        """Reset state for a new game."""
        self.player_streaks = {}


# Singleton instance
game_host = GameHost()

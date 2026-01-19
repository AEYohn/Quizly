"""
Question Quality Inspector - Gradio Interface
Evaluate AI-generated question quality using Gemini.
"""

import os
import sys
import json
import gradio as gr
import plotly.graph_objects as go

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from ai_agents.question_designer import QuestionDesigner

# Initialize designer
designer = QuestionDesigner()


def generate_and_evaluate(concept, difficulty, topic_context, num_questions):
    """Generate questions and evaluate their quality."""
    questions = []
    
    for i in range(int(num_questions)):
        q = designer.design_question(
            concept=concept,
            difficulty=difficulty,
            question_type="mcq",
            context=topic_context
        )
        q["id"] = i + 1
        q["concept"] = concept
        q["difficulty"] = difficulty
        questions.append(q)
    
    # Create display
    display_md = f"## Generated Questions for: {concept.replace('_', ' ').title()}\n\n"
    
    for q in questions:
        display_md += f"### Question {q['id']} (Difficulty: {difficulty:.1f})\n\n"
        display_md += f"**{q.get('prompt', 'No prompt')}**\n\n"
        
        for opt in q.get("options", []):
            marker = "✅" if opt.startswith(q.get("correct_answer", "X")) else "  "
            display_md += f"{marker} {opt}\n"
        
        display_md += f"\n**Explanation:** {q.get('explanation', 'None')[:200]}...\n\n"
        
        misconceptions = q.get("misconceptions_targeted", [])
        if misconceptions:
            display_md += "**Misconceptions Targeted:**\n"
            for m in misconceptions[:3]:
                display_md += f"- {m}\n"
        
        display_md += "\n---\n\n"
    
    return display_md, questions


def evaluate_question_quality(questions_json, clarity, depth, distractors):
    """Record quality evaluation from user."""
    if not questions_json:
        return "No questions to evaluate"
    
    avg_score = (clarity + depth + distractors) / 3
    
    eval_md = f"""
## Quality Evaluation

| Criterion | Score | Description |
|-----------|-------|-------------|
| Clarity | {clarity}/5 | How clear is the question wording? |
| Conceptual Depth | {depth}/5 | Does it test deep understanding? |
| Distractor Quality | {distractors}/5 | Are wrong answers plausible? |
| **Overall** | **{avg_score:.1f}/5** | Average quality score |

### Interpretation

"""
    
    if avg_score >= 4.0:
        eval_md += "✅ **Excellent** — Question meets quality standards for classroom use."
    elif avg_score >= 3.0:
        eval_md += "⚠️ **Acceptable** — Minor improvements recommended."
    else:
        eval_md += "❌ **Needs Work** — Significant revision needed."
    
    # Track for comparison
    return eval_md


def batch_evaluate(topic, concepts_text, difficulty_range, num_per_concept):
    """Batch generate and evaluate questions across concepts."""
    concepts = [c.strip() for c in concepts_text.split(",")]
    all_results = []
    
    diff_low, diff_high = difficulty_range
    difficulties = [diff_low, (diff_low + diff_high) / 2, diff_high]
    
    results_md = f"## Batch Evaluation: {topic}\n\n"
    
    for concept in concepts:
        results_md += f"### {concept.replace('_', ' ').title()}\n\n"
        
        for diff in difficulties:
            q = designer.design_question(concept, diff, "mcq", topic)
            
            # Simple quality heuristic
            prompt_len = len(q.get("prompt", ""))
            has_explanation = len(q.get("explanation", "")) > 50
            num_options = len(q.get("options", []))
            
            quality = "✅" if (prompt_len > 30 and has_explanation and num_options == 4) else "⚠️"
            
            results_md += f"- Diff {diff:.1f}: {quality} {q.get('prompt', '')[:60]}...\n"
            
            all_results.append({
                "concept": concept,
                "difficulty": diff,
                "quality": quality,
                "prompt": q.get("prompt", "")
            })
        
        results_md += "\n"
    
    # Summary chart
    good = sum(1 for r in all_results if r["quality"] == "✅")
    total = len(all_results)
    
    fig = go.Figure(data=[
        go.Pie(labels=["Good", "Needs Work"], 
               values=[good, total - good],
               marker_colors=["#22c55e", "#f59e0b"])
    ])
    fig.update_layout(title=f"Question Quality: {good}/{total} Pass")
    
    results_md += f"\n**Summary:** {good}/{total} questions ({100*good/total:.0f}%) meet quality threshold."
    
    return results_md, fig


# Gradio Interface
with gr.Blocks(title="Question Quality Inspector", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🔍 Question Quality Inspector
    
    Generate and evaluate AI-generated conceptual questions for peer instruction.
    
    **Quality Criteria:**
    - **Clarity**: Clear, unambiguous wording
    - **Conceptual Depth**: Tests understanding, not just recall
    - **Distractor Quality**: Wrong answers are plausible misconceptions
    """)
    
    with gr.Tabs():
        with gr.Tab("Single Question"):
            with gr.Row():
                with gr.Column():
                    concept = gr.Textbox(value="graph_connectivity", label="Concept")
                    difficulty = gr.Slider(0.1, 1.0, value=0.5, step=0.1, label="Difficulty")
                    context = gr.Textbox(value="CS 70 Discrete Mathematics", label="Topic Context")
                    num_q = gr.Slider(1, 5, value=1, step=1, label="Number of Questions")
                    gen_btn = gr.Button("🎲 Generate", variant="primary")
                
                with gr.Column():
                    questions_display = gr.Markdown("")
                    questions_state = gr.State([])
            
            gr.Markdown("### Rate Quality")
            with gr.Row():
                clarity = gr.Slider(1, 5, value=3, step=1, label="Clarity")
                depth = gr.Slider(1, 5, value=3, step=1, label="Conceptual Depth")
                distractors = gr.Slider(1, 5, value=3, step=1, label="Distractor Quality")
                eval_btn = gr.Button("📊 Evaluate")
            
            eval_result = gr.Markdown("")
        
        with gr.Tab("Batch Evaluation"):
            with gr.Row():
                batch_topic = gr.Textbox(value="Graph Theory", label="Topic")
                batch_concepts = gr.Textbox(value="bfs, dfs, trees, cycles", label="Concepts")
                diff_range = gr.Slider(0.1, 1.0, value=[0.3, 0.7], label="Difficulty Range")
                batch_btn = gr.Button("🔬 Run Batch", variant="primary")
            
            batch_results = gr.Markdown("")
            batch_chart = gr.Plot()
    
    # Events
    gen_btn.click(generate_and_evaluate, 
                 inputs=[concept, difficulty, context, num_q],
                 outputs=[questions_display, questions_state])
    
    eval_btn.click(evaluate_question_quality,
                  inputs=[questions_state, clarity, depth, distractors],
                  outputs=[eval_result])
    
    batch_btn.click(batch_evaluate,
                   inputs=[batch_topic, batch_concepts, diff_range, gr.Number(value=1, visible=False)],
                   outputs=[batch_results, batch_chart])


if __name__ == "__main__":
    print("🚀 Starting Question Inspector on http://localhost:7862")
    demo.launch(server_port=7862, share=False)

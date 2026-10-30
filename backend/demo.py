import gradio as gr

from backend.main import app as api_app
from backend.security.nemoclaw import NemoClawGuardrail


def inspect_prompt(text: str) -> tuple[str, str, str]:
    if not text.strip():
        return "", "", "Enter a prompt to inspect."

    guardrail = NemoClawGuardrail()
    sanitized, redaction_map, count = guardrail.sanitize_prompt(text)
    restored_echo = guardrail.restore_response(
        f"Echo-only simulation: {sanitized}",
        redaction_map,
    )
    return (
        sanitized,
        restored_echo,
        f"Detected and masked {count} sensitive value(s).",
    )


with gr.Blocks(title="SAYZE OS Privacy Guardrail") as demo:
    gr.Markdown(
        """
        # SAYZE OS Privacy Guardrail

        See how the backend masks email addresses, phone numbers, valid credit
        card numbers, and SSNs before a prompt would be sent to a model.
        This playground runs the guardrail and an echo-only restoration
        simulation; it does not call an AI or web-search provider.

        **Use synthetic examples only.** Text entered in this hosted demo is
        processed by the Space server and is not suitable for real personal data.
        """
    )
    prompt = gr.Textbox(
        label="Example prompt",
        value=(
            "Contact alex@example.com at (415) 555-0132. "
            "SSN: 123-45-6789; card: 4111 1111 1111 1111."
        ),
        lines=4,
    )
    inspect_button = gr.Button("Inspect prompt", variant="primary")
    status = gr.Markdown()
    with gr.Row():
        sanitized_output = gr.Textbox(
            label="Sanitized prompt (provider-bound in production)",
            lines=4,
        )
        restored_output = gr.Textbox(
            label="Echo after local token restoration",
            lines=4,
        )
    inspect_button.click(
        fn=inspect_prompt,
        inputs=prompt,
        outputs=[sanitized_output, restored_output, status],
    )

app = gr.mount_gradio_app(api_app, demo, path="/")

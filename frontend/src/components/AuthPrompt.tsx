import { useTranslation } from "../context/language/i18n";

// one step of the login or register flow
export type AuthStep = {
  // matches the `step` field of the matching AuthFlow
  key: string;
  // already-translated label
  label: string;
  // the answer, echoed back once the step is done, empty for passwords
  value?: string;
};

// shared body of the login and register screens, a checklist of the steps
// the prompt is walking through
export default function AuthPrompt({
  steps,
  current,
  error,
}: {
  steps: AuthStep[];
  // the step the prompt is on, null when the flow isn't running
  current: string | null;
  error: string;
}) {
  const { t } = useTranslation();
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <>
      <p className="terminal-copy">
        {t("Answer each prompt in the command line below.")}
      </p>
      <ol className="terminal-list auth-steps">
        {steps.map((step, index) => {
          const state =
            currentIndex < 0 || index > currentIndex
              ? "pending"
              : index === currentIndex
                ? "current"
                : "done";
          return (
            <li key={step.key} data-state={state}>
              <span>{step.label}</span>
              {state === "done" && step.value ? ` ${step.value}` : ""}
            </li>
          );
        })}
      </ol>
      <p className="terminal-copy">{t("Press Ctrl+C or Esc to cancel.")}</p>
      {error && <p className="terminal-error">{error}</p>}
    </>
  );
}

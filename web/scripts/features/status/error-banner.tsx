/** The red banner under the top bar, for example when the server can't be reached. Hidden when text is null. */
export function ErrorBanner({ text }: { text: string | null }) {
  return (
    <div className="error-banner" hidden={text === null}>
      {text ?? ''}
    </div>
  );
}

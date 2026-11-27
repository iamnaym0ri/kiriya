// "sent to josh ♡": the composer leaves a line for the quizzes screen it returns to.
let note = null;
export const leaveSentNote = (text) => {
  note = text;
};
export function takeSentNote() {
  const text = note;
  note = null;
  return text;
}

// zxcvbn is ~800 KB with its dictionaries, so it loads only when a strength check is needed
let ready;
function load() {
  ready ??= Promise.all([import('@zxcvbn-ts/core'), import('@zxcvbn-ts/language-common')]).then(([core, common]) => {
    const factory = new core.ZxcvbnFactory({ dictionary: { ...common.dictionary }, graphs: common.adjacencyGraphs });
    return (pw, inputs) => factory.check(pw, inputs);
  });
  return ready;
}

export async function checkStrength(password, userInputs = []) {
  if (!password) return { score: 0, warning: '', suggestions: [] };
  const zxcvbn = await load();
  const r = zxcvbn(password.slice(0, 100), userInputs);
  return { score: r.score, warning: r.feedback.warning || '', suggestions: r.feedback.suggestions || [] };
}

export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

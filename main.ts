import './styles.css';
import { reconcile } from './engine/reconcile';
import type { ReconcileResult } from './engine/types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('No se encontró el contenedor principal.');

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      <div>
        <h1>Lista Clínica</h1>
        <p>Exámenes complementarios</p>
      </div>
      <div class="privacy-badge" title="El texto no sale de este navegador">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z"/></svg>
        Procesamiento local
      </div>
    </header>

    <section class="workspace" aria-label="Reconciliador de exámenes complementarios">
      <article class="input-card card-yesterday">
        <div class="card-heading">
          <span class="step">01</span>
          <label for="yesterday">Lista de ayer</label>
        </div>
        <textarea id="yesterday" spellcheck="false" autocomplete="off" placeholder="Pegá la columna de exámenes complementarios de ayer"></textarea>
      </article>

      <article class="input-card card-lab">
        <div class="card-heading">
          <span class="step">02</span>
          <label for="today-lab">Laboratorios de hoy</label>
        </div>
        <textarea id="today-lab" spellcheck="false" autocomplete="off" placeholder="Pegá el laboratorio crudo o una línea compacta"></textarea>
        <p class="field-note">Las intervenciones pueden ir pegadas al valor: +K, +P, +Mg, UGR o UP.</p>
      </article>

      <article class="input-card card-studies">
        <div class="card-heading">
          <span class="step">03</span>
          <label for="today-studies">Estudios / imágenes de hoy</label>
          <span class="optional">Opcional</span>
        </div>
        <textarea id="today-studies" spellcheck="false" autocomplete="off" placeholder="Pegá informes nuevos o resultados microbiológicos"></textarea>
      </article>

      <article class="result-card">
        <div class="card-heading result-heading">
          <span class="step step-result">04</span>
          <label for="result">Lista de hoy</label>
          <span id="result-state" class="result-state">Sin generar</span>
        </div>
        <textarea id="result" readonly aria-live="polite" placeholder="La lista reconciliada aparece acá"></textarea>
        <div id="review-panel" class="review-panel" hidden></div>
      </article>
    </section>

    <div class="actions" role="group" aria-label="Acciones">
      <button id="generate" class="button button-primary" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
        Generar lista
      </button>
      <button id="copy" class="button button-secondary" type="button" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8h10v11H9zM5 5h10v3M5 5v11h4"/></svg>
        Copiar
      </button>
      <button id="clear" class="button button-ghost" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>
        Limpiar
      </button>
    </div>

    <footer>
      <span>Sin backend · Sin almacenamiento · Sin IA</span>
      <span>Ctrl/⌘ + Enter para generar</span>
    </footer>
  </main>
`;

const yesterday = document.querySelector<HTMLTextAreaElement>('#yesterday');
const todayLab = document.querySelector<HTMLTextAreaElement>('#today-lab');
const todayStudies = document.querySelector<HTMLTextAreaElement>('#today-studies');
const result = document.querySelector<HTMLTextAreaElement>('#result');
const generateButton = document.querySelector<HTMLButtonElement>('#generate');
const copyButton = document.querySelector<HTMLButtonElement>('#copy');
const clearButton = document.querySelector<HTMLButtonElement>('#clear');
const resultState = document.querySelector<HTMLSpanElement>('#result-state');
const reviewPanel = document.querySelector<HTMLDivElement>('#review-panel');

if (
  !yesterday ||
  !todayLab ||
  !todayStudies ||
  !result ||
  !generateButton ||
  !copyButton ||
  !clearButton ||
  !resultState ||
  !reviewPanel
) {
  throw new Error('No se pudieron inicializar los controles.');
}

const announceResult = (reconciliation: ReconcileResult): void => {
  result.value = reconciliation.output;
  copyButton.disabled = !reconciliation.output;
  const reviewWarnings = reconciliation.warnings.filter(
    (warning) => !['TREND_OMITTED'].includes(warning.code),
  );

  if (!reconciliation.output) {
    resultState.textContent = 'Sin datos';
    resultState.dataset.status = 'empty';
  } else if (reviewWarnings.length) {
    resultState.textContent = 'Revisar';
    resultState.dataset.status = 'review';
  } else {
    resultState.textContent = 'Generada';
    resultState.dataset.status = 'ready';
  }

  if (reviewWarnings.length) {
    reviewPanel.hidden = false;
    reviewPanel.innerHTML = `
      <div class="review-title">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Zm0 6v4m0 3h.01"/></svg>
        Revisión manual necesaria
      </div>
      <ul>${reviewWarnings
        .map(
          (warning) =>
            `<li>${escapeHtml(warning.message)}${warning.detail ? `<span>${escapeHtml(warning.detail)}</span>` : ''}</li>`,
        )
        .join('')}</ul>
    `;
  } else {
    reviewPanel.hidden = true;
    reviewPanel.replaceChildren();
  }
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] ?? character,
  );

const generate = (): void => {
  announceResult(
    reconcile({
      yesterday: yesterday.value,
      todayLab: todayLab.value,
      todayStudies: todayStudies.value,
    }),
  );
};

generateButton.addEventListener('click', generate);

copyButton.addEventListener('click', async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
    copyButton.classList.add('copied');
    copyButton.lastChild!.textContent = ' Copiado';
    window.setTimeout(() => {
      copyButton.classList.remove('copied');
      copyButton.lastChild!.textContent = ' Copiar';
    }, 1600);
  } catch {
    result.focus();
    result.select();
    document.execCommand('copy');
  }
});

clearButton.addEventListener('click', () => {
  yesterday.value = '';
  todayLab.value = '';
  todayStudies.value = '';
  result.value = '';
  copyButton.disabled = true;
  resultState.textContent = 'Sin generar';
  delete resultState.dataset.status;
  reviewPanel.hidden = true;
  reviewPanel.replaceChildren();
  yesterday.focus();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    generate();
  }
});

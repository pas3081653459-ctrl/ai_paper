import { reactive, ref, watch } from 'vue'

export interface EvidenceBook {
  answers: Record<string, string>
  checked: Record<string, boolean>
  notes: string
}

/** Only small learner-authored records are persisted; no uploaded traces or model data. */
export function useEvidenceNotebook(paperId: string) {
  const key = `channel-lab:evidence:v1:${paperId}`
  const book = reactive<EvidenceBook>({ answers: {}, checked: {}, notes: '' })
  const saved = ref(true)
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object') throw Error('Invalid notebook')
      const v = value as Record<string, unknown>
      if (v.version !== 1) throw Error('Unsupported notebook version')
      if (typeof v.notes === 'string') book.notes = v.notes.slice(0, 4000)
      for (const field of ['answers', 'checked'] as const) {
        const entries = v[field]
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue
        for (const [id, item] of Object.entries(entries).slice(0, 30)) {
          if (!/^[a-z][a-z0-9-]{0,49}$/.test(id)) continue
          if (field === 'answers' && typeof item === 'string') book.answers[id] = item.slice(0, 200)
          if (field === 'checked' && typeof item === 'boolean') book.checked[id] = item
        }
      }
    }
  } catch { saved.value = false }
  watch(book, () => {
    try { localStorage.setItem(key, JSON.stringify({ version: 1, ...book })); saved.value = true }
    catch { saved.value = false }
  }, { deep: true })
  function answer(id: string, value: string) { book.answers[id] = value; book.checked[id] = false }
  function check(id: string) { if (book.answers[id]) book.checked[id] = true }
  function reset() { book.answers = {}; book.checked = {}; book.notes = '' }
  function download(context: unknown) {
    const payload = { version: 1, paper_id: paperId, exported_at: new Date().toISOString(),
      kind: 'learner-notebook-not-model-trace', ...book, context }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = `paper-${paperId}-notebook.json`; link.click()
    // Allow the browser to start consuming the object URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { book, saved, answer, check, reset, download }
}

import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  evidencePurgeAt,
  isEvidenceDue,
  validateEvidenceFile,
} from './hours-evidence'

describe('validateEvidenceFile', () => {
  const ok = { name: 'captura.png', type: 'image/png', size: 1024 }
  it('acepta imágenes, documentos, zip, txt y csv', () => {
    for (const [name, type] of [
      ['a.png', 'image/png'],
      ['a.jpg', 'image/jpeg'],
      ['a.webp', 'image/webp'],
      ['a.gif', 'image/gif'],
      ['a.pdf', 'application/pdf'],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['a.xls', 'application/vnd.ms-excel'],
      ['a.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ['a.zip', 'application/zip'],
      ['a.txt', 'text/plain'],
      ['a.csv', 'text/csv'],
    ])
      expect(() => validateEvidenceFile({ name, type, size: 10 })).not.toThrow()
  })
  it('rechaza ejecutables, svg, html y tipos fuera de la lista', () => {
    expect(() => validateEvidenceFile({ ...ok, name: 'a.svg', type: 'image/svg+xml' })).toThrow(
      'Este tipo de archivo no está permitido.',
    )
    expect(() =>
      validateEvidenceFile({ ...ok, name: 'setup.exe', type: 'application/x-msdownload' }),
    ).toThrow('Este tipo de archivo no está permitido.')
    expect(() => validateEvidenceFile({ ...ok, name: 'run.exe', type: 'application/pdf' })).toThrow(
      'Este tipo de archivo no está permitido.',
    )
    expect(() => validateEvidenceFile({ ...ok, type: 'text/html' })).toThrow(
      'Este tipo de archivo no está permitido.',
    )
  })
  it('exige nombre de 1 a 255 caracteres sin barras y un tamaño dentro del límite', () => {
    expect(() => validateEvidenceFile({ ...ok, name: '  ' })).toThrow(
      'El nombre del archivo debe tener de 1 a 255 caracteres.',
    )
    expect(() => validateEvidenceFile({ ...ok, name: 'a/b.png' })).toThrow(
      'El nombre del archivo debe tener de 1 a 255 caracteres.',
    )
    expect(() => validateEvidenceFile({ ...ok, size: 0 })).toThrow(
      'El archivo está vacío o pesa demasiado.',
    )
    expect(() => validateEvidenceFile({ ...ok, size: EVIDENCE_MAX_BYTES + 1 })).toThrow(
      'El archivo está vacío o pesa demasiado.',
    )
    expect(() => validateEvidenceFile({ ...ok, size: 4000 }, 3000)).toThrow(
      'El archivo está vacío o pesa demasiado.',
    )
  })
  it('el máximo es de 5 archivos y 10 MiB', () => {
    expect(EVIDENCE_MAX_FILES).toBe(5)
    expect(EVIDENCE_MAX_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('retención', () => {
  it('el archivo se guarda 7 días desde que se valida', () => {
    expect(evidencePurgeAt(new Date('2026-10-01T10:00:00.000Z'))).toBe('2026-10-08T10:00:00.000Z')
  })
  it('vence cuando purgeAt ya pasó y no se retiró', () => {
    const now = new Date('2026-10-08T10:00:00.000Z')
    expect(isEvidenceDue({ purgeAt: '2026-10-08T10:00:00.000Z', purged: false }, now)).toBe(true)
    expect(isEvidenceDue({ purgeAt: '2026-10-08T10:00:01.000Z', purged: false }, now)).toBe(false)
    expect(isEvidenceDue({ purgeAt: null, purged: false }, now)).toBe(false)
    expect(isEvidenceDue({ purgeAt: '2026-10-01T00:00:00.000Z', purged: true }, now)).toBe(false)
  })
})

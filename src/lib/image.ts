const MAX_SIDE = 1024
const QUALITY = 0.7
const MAX_INPUT_BYTES = 12 * 1024 * 1024

/**
 * Reduce la foto de un comprobante para guardarla en el mock (data URL JPEG de ~100 KB). En la etapa 2 el
 * archivo original sube al bucket privado de Supabase Storage y aquí solo quedaría la URL.
 */
export async function fileToReceipt(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Elige una foto o una imagen del comprobante')
  if (file.size > MAX_INPUT_BYTES) throw new Error('La imagen pesa demasiado (máximo 12 MB)')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo procesar la imagen')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', QUALITY)
}

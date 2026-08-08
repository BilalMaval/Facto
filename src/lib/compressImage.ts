// Browser-only canvas-based image compressor. Scales the image to fit within
// maxDimension and re-encodes as JPEG at the given quality, so uploads use
// less bandwidth and storage. Skips files already under skipBelowBytes since
// re-encoding a small file can make it larger, not smaller.
export async function compressImage(
  file: File,
  { maxDimension, quality, skipBelowBytes = 150_000 }: { maxDimension: number; quality: number; skipBelowBytes?: number }
): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= skipBelowBytes) {
    return file
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg' })
}

const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_STORED_IMAGE_BYTES = 1.5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1400

export async function optimizeImage(file: File, fileName: string): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Choose an image smaller than 15 MB.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    try {
      await image.decode()
    } catch {
      throw new Error('Could not open this image. Try a JPG, PNG, or WebP file.')
    }

    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process this image.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.68, 0.54]) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', quality)
      })
      if (blob && blob.size <= MAX_STORED_IMAGE_BYTES) {
        const extension =
          blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
        return new File([blob], `${fileName}.${extension}`, { type: blob.type })
      }
    }

    throw new Error('This image is too large after optimization. Try a smaller image.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

import { Readable } from 'node:stream'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { uploadFileToStorage } from '@/infra/storage/upload-file-to-storage'
import { z } from 'zod'
import { InvalidFileFormat } from './errors/invalid-file-format'

const uploadImageInput = z.object({
  fileName: z.string(),
  contentType: z.string(),
  contentStream: z.instanceof(Readable),
  // Zod ñ tem tipo nativo p/ Streamm, então tem que usar o instanceof de Readable que vem do node.
})

type UploadImageInput = z.input<typeof uploadImageInput> ///z.input<T> é o tipo de uma entrada de um schema do Zod

const allowedMimeTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/webp']

export async function uploadImage(
  input: UploadImageInput
): Promise<Either<InvalidFileFormat, { url: string }>> {
  //Como tipagem, o Either é um tipo de dado que pode ser Left ou Right.
  const { contentStream, contentType, fileName } = uploadImageInput.parse(input)

  if (!allowedMimeTypes.includes(contentType)) {
    return makeLeft(new InvalidFileFormat()) // criar um erro p/ returnar
  }

  //carregar a imagem p/ o Cloudflare R2
  const { key, url } = await uploadFileToStorage({
    folder: 'images',
    fileName,
    contentType,
    contentStream,
  })

  //salvar o nome do arquivo no banco de dados
  await db.insert(schema.uploads).values({
    name: fileName,
    remoteKey: key,
    remoteUrl: url,
  })

  return makeRight({ url }) // criar um sucesso p/ retornar
}

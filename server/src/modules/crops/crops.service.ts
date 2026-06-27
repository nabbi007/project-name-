import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { slugify } from '../../utils/slug';
import { CreateCategoryInput } from './crops.validators';

const categorySelect = {
  uuid: true,
  name: true,
  slug: true,
  description: true,
  defaultUnit: true,
  status: true,
} satisfies Prisma.CropCategorySelect;

export async function listCategories() {
  return prisma.cropCategory.findMany({
    where: { status: 'ACTIVE' },
    select: categorySelect,
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = slugify(input.name);
  const existing = await prisma.cropCategory.findFirst({
    where: { OR: [{ name: { equals: input.name, mode: 'insensitive' } }, { slug }] },
    select: { id: true },
  });
  if (existing) {
    throw AppError.conflict('A crop category with this name already exists', 'CATEGORY_EXISTS');
  }

  return prisma.cropCategory.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      defaultUnit: input.defaultUnit,
    },
    select: categorySelect,
  });
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug by appending a number if necessary
 */
export async function generateUniqueSlug(
  text: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = generateSlug(text);
  let slug = baseSlug;
  let counter = 1;
  
  // Keep checking until we find a unique slug
  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}
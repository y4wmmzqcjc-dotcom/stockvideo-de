import { defineCollection, z } from 'astro:content';

const videos = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    duration: z.number(),
    resolution: z.string(),
    fps: z.number(),
    thumbnail: z.string(),
    preview: z.string().optional(),
    price: z.object({
      web: z.number(),
      broadcast: z.number(),
      extended: z.number(),
    }),
    featured: z.boolean().default(false),
  }),
});

export const collections = { videos };

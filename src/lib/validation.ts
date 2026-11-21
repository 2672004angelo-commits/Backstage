import { z } from "zod";

export const bookingSchema = z.object({
  showId: z.string().regex(/^[a-f\d]{24}$/i),
  performanceId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
  fullName: z.string().trim()
    .min(7, "يجب إدخال الاسم رباعيًا")
    .max(100)
    .refine((name) => name.split(/\s+/).filter(Boolean).length >= 4, "يجب إدخال الاسم رباعيًا"),
  mobile: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
  email: z.string().email().optional().or(z.literal("")),
  quantity: z.number().int().min(1).max(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const castMemberSchema = z.object({
  name: z.string().trim().min(2).max(100),
  role: z.string().trim().max(100).default(""),
  photoFileId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

const performanceSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  open: z.boolean().default(true),
});

export const showSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).default(""),
  date: z.string(),
  time: z.string(),
  venue: z.string().trim().min(2).max(200),
  price: z.number().nonnegative(),
  capacity: z.number().int().positive(),
  open: z.boolean().default(true),
  performances: z.array(performanceSchema).min(1).max(20).optional(),
  cast: z.array(castMemberSchema).max(30).default([]),
});

export const sitePageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  content: z.string().trim().max(20000),
  published: z.boolean(),
});

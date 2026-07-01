import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  // empty string = keep existing password; non-empty must satisfy minimum length
  password: z.string().refine(
    (val) => val === "" || val.length >= 8,
    "Password must be at least 8 characters"
  ),
});

export type EditUserInput = z.infer<typeof editUserSchema>;

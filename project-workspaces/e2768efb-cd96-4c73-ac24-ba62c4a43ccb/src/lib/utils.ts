// src/lib/utils.ts
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ClassValue = string | boolean | undefined | null | { [key: string]: boolean } | ClassValue[];

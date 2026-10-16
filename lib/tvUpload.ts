"use client";

// v0.14 Clout TV: the photo goes from the phone straight to the private big-screen bucket (Supabase
// Storage), into the player's own folder, so the server never carries the file. It's redrawn first:
// resized, re-encoded as JPEG, its location and camera data left behind.

import { TV, tvError, type Crop, type TvResult } from "./cloutTv";
import { getBrowserSupabase } from "./supabase/client";

/** Opens a picked photo the right way up. */
export function openPhoto(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
}

/**
 * Draws the cropped photo at the billboard's size (TV.frame) as a JPEG. `crop` is in the frame's
 * on-screen pixels; `frameWidth` is how wide the frame was drawn.
 */
export function cropToFrame(img: ImageBitmap, crop: Crop, frameWidth: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = TV.frame.w;
  canvas.height = TV.frame.h;
  const k = TV.frame.w / frameWidth;
  const x = canvas.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, crop.x * k, crop.y * k, img.width * crop.scale * k, img.height * crop.scale * k);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", TV.quality));
}

export async function uploadToBigScreen(photo: Blob): Promise<TvResult<string>> {
  const supabase = getBrowserSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(TV.bucket).upload(path, photo, { contentType: "image/jpeg", upsert: false });
  if (error) return { ok: false, error: tvError(error.message) };
  return { ok: true, data: path };
}

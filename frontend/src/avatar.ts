// Avatar uploads: the user picks a file and the bytes are what
// gets stored, rather than a link.
//
// The file is downscaled here, in the browser, before it goes anywhere. The
// user list returns every user's avatar in one response, so a page of
// full-size uploads would be megabytes; at 256px each one is a few tens of KB.

export const AVATAR_MAX_BYTES = 500 * 1024;
export const AVATAR_MAX_PX = 256;
export const AVATAR_TYPES = ["image/png", "image/jpeg"] as const;

// The size limit applies to the file as picked, so an oversized image is
// refused rather than silently shrunk into the limit.
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type as (typeof AVATAR_TYPES)[number])) {
    return "Avatar must be a PNG or JPEG image.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "Avatar must be 500 KB or smaller.";
  }
  return null;
}

// longest side down to AVATAR_MAX_PX, aspect kept. already-small images are
// left alone rather than upscaled
export function scaledSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= AVATAR_MAX_PX) return { width, height };
  const ratio = AVATAR_MAX_PX / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}


// load an image from a file, returning a promise that resolves when the
// image is decoded and its natural size is known. rejects if the file is not
// a valid image.
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // an object URL rather than a base64 read: the browser decodes straight
    // from the blob, and it's revoked either way before this settles
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image."));
    };
    image.src = objectUrl;
  });
}

// the picked file, downscaled, as the string stored in avatarUrl.
// re-encoded in the format it arrived in, so a PNG keeps its transparency
export async function avatarToData(file: File): Promise<string> {
  const problem = validateAvatarFile(file);
  if (problem) throw new Error(problem);

  const image = await loadImage(file);
  const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process that image.");
  context.drawImage(image, 0, 0, width, height);

  // quality is ignored for image/png
  return canvas.toDataURL(file.type, 0.85);
}

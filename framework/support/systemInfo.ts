import si from 'systeminformation';

export async function getPrimaryDisplayResolution(): 
  Promise<{ width: number; height: number }> {
  
  try {
    const graphics = await si.graphics();
    const primary = graphics.displays?.[0];

    const width = primary?.resolutionX ?? 1920;
    const height = primary?.resolutionY ?? 1080;

    return { width: Number(width), height: Number(height) };
  } catch {
    return { width: 1920, height: 1080 };
  }
}

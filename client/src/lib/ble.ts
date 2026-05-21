// Web Bluetooth pairing helpers for LITTR bins.
// The bin advertises a custom GATT service. The browser writes (nonce, deviceKey, serial)
// to a single characteristic; the bin then connects to WiFi and calls POST /api/device/claim.

export const LITTR_SERVICE_UUID = "5af49a32-9c0f-4d4a-9b9e-7a26c3a1b001";
export const LITTR_PAIR_CHAR_UUID = "5af49a32-9c0f-4d4a-9b9e-7a26c3a1b002";

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
}

export async function pairBinOverBLE(payload: { deviceKey: string; nonce: string; serial: string }): Promise<void> {
  if (!isWebBluetoothAvailable()) throw new Error("Web Bluetooth not available");
  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: [LITTR_SERVICE_UUID] }, { namePrefix: "LITTR-" }],
    optionalServices: [LITTR_SERVICE_UUID],
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(LITTR_SERVICE_UUID);
  const ch = await service.getCharacteristic(LITTR_PAIR_CHAR_UUID);
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  await ch.writeValue(bytes);
  try { device.gatt.disconnect(); } catch { /* ignore */ }
}

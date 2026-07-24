// Driver selection. This is the one place that knows which StorageDriver the
// process runs; call sites import `storageDriver` and nothing else.
//
//   STORAGE_DRIVER unset | "local"  -> LocalDiskDriver (default; today's behavior)
//   STORAGE_DRIVER "s3"             -> not implemented yet, see TODO(s3) in ./driver.ts
//   anything else                   -> hard error at boot
//
// Unknown/unimplemented values throw instead of falling back to local disk on
// purpose: a silent fallback on a multi-instance deploy means writes land on
// whichever container served the request and are lost on the next redeploy.
// Fail at boot, loudly, where it is a config bug and not a data-loss incident.

import { LocalDiskDriver } from "./localDisk";
import { STORAGE_DRIVERS, type StorageDriver, type StorageDriverName } from "./driver";

export {
  absoluteUrl,
  STORAGE_DRIVERS,
  type PutArtifactResult,
  type PutPhotoResult,
  type StaticMount,
  type StorageDriver,
  type StorageDriverName,
} from "./driver";
export { LocalDiskDriver } from "./localDisk";

// Validate STORAGE_DRIVER. Unset/empty means "local" so the current deploy needs
// no new env var. Exported for unit tests (pure — no fs, no env read).
export function parseDriverName(raw: string | undefined): StorageDriverName {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "local") return "local";
  if (v === "s3") return "s3";
  throw new Error(
    `STORAGE_DRIVER="${raw}" is not a known driver (expected one of: ${STORAGE_DRIVERS.join(", ")})`,
  );
}

// Construct a driver by name. The ONE place a new backend gets wired in.
export function createDriver(name: StorageDriverName): StorageDriver {
  switch (name) {
    case "local":
      return new LocalDiskDriver();
    case "s3":
      // Replace with `return new S3Driver()` once server/blobstore/s3.ts
      // satisfies the TODO(s3) contract in ./driver.ts.
      throw new Error(
        "STORAGE_DRIVER=s3 is declared but not implemented — see TODO(s3) in " +
          "server/blobstore/driver.ts for the contract an S3/R2 driver must meet. " +
          "Unset STORAGE_DRIVER to use local disk.",
      );
  }
}

let cached: StorageDriver | undefined;

// Lazy + memoized: the driver is constructed on first use, so importing this
// module (e.g. from a unit test) never touches the filesystem or throws on a
// stray env var. server/index.ts calls staticMount() at boot, which is what
// makes a bad STORAGE_DRIVER fail fast rather than at the first upload.
export function getStorageDriver(): StorageDriver {
  return (cached ??= createDriver(parseDriverName(process.env.STORAGE_DRIVER)));
}

// Ergonomic facade for call sites: `storageDriver.putPhoto(...)`. Delegates to
// the memoized instance on every access, so it stays lazy.
export const storageDriver: StorageDriver = {
  get name(): StorageDriverName {
    return getStorageDriver().name;
  },
  putPhoto: (deviceId, jpeg) => getStorageDriver().putPhoto(deviceId, jpeg),
  putArtifact: (kind, origName, buf) => getStorageDriver().putArtifact(kind, origName, buf),
  staticMount: () => getStorageDriver().staticMount(),
};

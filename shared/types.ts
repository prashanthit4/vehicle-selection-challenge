// Shared contracts between frontend and backend.

/** Make → Model → Badges, matching the shape of vehicleData.json. */
export type VehicleCatalog = Record<string, Record<string, string[]>>;

/** A fully specified vehicle. */
export interface VehicleSelection {
  make: string;
  model: string;
  badge: string;
}

/** Form fields of POST /upload. */
export interface VehicleSubmission extends VehicleSelection {
  /** Plain-text logbook contents read client-side. Required, within the configured size limit. */
  logbookText: string;
  /** Original file name, checked against ALLOWED_EXTENSIONS. */
  logbookFileName: string;
  /** Browser-reported MIME type (may be empty), checked against ALLOWED_MIME_TYPES. */
  logbookMimeType: string;
}
